/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class ZabbixService implements OnModuleInit {
  private readonly logger = new Logger(ZabbixService.name);

  // sfp-ports-stats and switch-uptime-stats are computed on a schedule
  // instead of per-request — both have been observed taking 20s+ (their
  // MAX_EXECUTION_TIME cap) when run live, despite completing in well
  // under a second when run directly against the database. Serving a
  // cached result keeps the API fast and reliable regardless of that
  // unresolved discrepancy.
  private sfpPortsCache: unknown[] = [];
  private switchUptimeCache: unknown[] = [];

  constructor(
    @InjectDataSource('zabbix')
    private zabbixDataSource: DataSource,
  ) {}

  onModuleInit(): void {
    void this.refreshSfpPortsCache();
    void this.refreshSwitchUptimeCache();
  }

  @Cron('*/2 * * * *')
  async refreshSfpPortsCache(): Promise<void> {
    const start = Date.now();
    try {
      this.sfpPortsCache = await this.computeSfpPortsStats();
      this.logger.log(
        `SFP ports cache refreshed: ${this.sfpPortsCache.length} rows in ${Date.now() - start}ms`,
      );
    } catch (err) {
      this.logger.error('Failed to refresh SFP ports cache', err);
    }
  }

  @Cron('*/2 * * * *')
  async refreshSwitchUptimeCache(): Promise<void> {
    const start = Date.now();
    try {
      this.switchUptimeCache = await this.computeSwitchUptimeStats();
      this.logger.log(
        `Switch uptime cache refreshed: ${this.switchUptimeCache.length} rows in ${Date.now() - start}ms`,
      );
    } catch (err) {
      this.logger.error('Failed to refresh switch uptime cache', err);
    }
  }

  // The latest reading for one item — a single descending index seek on
  // (itemid, clock). This is the only primitive the cached stats below are
  // allowed to use against history_uint besides plain 30-day range
  // aggregates: monolithic queries combining many correlated subqueries
  // reliably exceeded 20s when run through the app despite being fast when
  // run manually, so everything is decomposed into these trivial lookups.
  private async latestHistoryUint(
    itemid: number,
  ): Promise<{ value: number; clock: number } | null> {
    const rows: any[] = await this.zabbixDataSource.query(
      `SELECT /*+ MAX_EXECUTION_TIME(5000) */ value, clock
       FROM history_uint WHERE itemid = ?
       ORDER BY clock DESC LIMIT 1`,
      [itemid],
    );
    if (!rows.length) return null;
    return { value: Number(rows[0].value), clock: Number(rows[0].clock) };
  }

  async ping(): Promise<{ status: string }> {
    await this.zabbixDataSource.query('SELECT 1');
    return { status: 'Zabbix DB connected' };
  }

  async getHosts(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.hostid,
        h.host,
        h.name,
        h.status,
        h.description,
        MAX(i.available) as available
      FROM hosts h
      LEFT JOIN interface i ON i.hostid = h.hostid
      WHERE h.flags = 0 
        AND h.templateid IS NULL
      GROUP BY h.hostid, h.host, h.name, h.status, h.description
      ORDER BY h.name
    `);
  }

  async getHostStats(): Promise<unknown> {
    const rows: unknown[] = await this.zabbixDataSource.query(`
    SELECT /*+ MAX_EXECUTION_TIME(20000) */
      COUNT(DISTINCT h.hostid) as total,
      SUM(CASE WHEN h.status = 0 AND i.available = 1 THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN h.status = 0 AND i.available = 2 THEN 1 ELSE 0 END) as offline,
      SUM(CASE WHEN h.status = 0 AND (i.available = 0 OR i.available IS NULL) THEN 1 ELSE 0 END) as unknown,
      SUM(CASE WHEN h.status = 1 THEN 1 ELSE 0 END) as disabled,
      SUM(CASE WHEN h.maintenance_status = 1 THEN 1 ELSE 0 END) as in_maintenance
    FROM hosts h
    LEFT JOIN interface i ON i.hostid = h.hostid
    WHERE h.flags = 0
      AND h.status != 3
  `);
    return rows[0];
  }

  async getTriggerStats(): Promise<unknown> {
    const rows: unknown[] = await this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        COUNT(*) as total,
        SUM(CASE WHEN t.value = 1 AND t.status = 0 THEN 1 ELSE 0 END) as problem,
        SUM(CASE WHEN t.value = 0 AND t.status = 0 THEN 1 ELSE 0 END) as ok,
        SUM(CASE WHEN t.priority = 5 AND t.value = 1 THEN 1 ELSE 0 END) as disaster,
        SUM(CASE WHEN t.priority = 4 AND t.value = 1 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN t.priority = 3 AND t.value = 1 THEN 1 ELSE 0 END) as average,
        SUM(CASE WHEN t.priority = 2 AND t.value = 1 THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN t.priority = 1 AND t.value = 1 THEN 1 ELSE 0 END) as info
      FROM triggers t
      JOIN functions f ON f.triggerid = t.triggerid
      JOIN items i ON i.itemid = f.itemid
      JOIN hosts h ON h.hostid = i.hostid
      WHERE t.flags = 0
        AND h.templateid IS NULL
        AND h.flags = 0
    `);
    return rows[0];
  }

  async getRecentEvents(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        e.eventid,
        e.clock,
        e.name,
        e.severity,
        e.value,
        e.acknowledged,
        FROM_UNIXTIME(e.clock) as event_time,
        h.name as host_name
      FROM events e
      JOIN triggers t ON t.triggerid = e.objectid
      JOIN functions f ON f.triggerid = t.triggerid
      JOIN items i ON i.itemid = f.itemid
      JOIN hosts h ON h.hostid = i.hostid
      WHERE e.source = 0
        AND h.templateid IS NULL
        AND h.flags = 0
      GROUP BY e.eventid, e.clock, e.name, e.severity, e.value, e.acknowledged, h.name
      ORDER BY e.clock DESC
      LIMIT 50
    `);
  }

  async getEventsByDay(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        DATE(FROM_UNIXTIME(e.clock)) as day,
        COUNT(*) as total,
        SUM(CASE WHEN e.value = 1 THEN 1 ELSE 0 END) as problems,
        SUM(CASE WHEN e.value = 0 THEN 1 ELSE 0 END) as resolved
      FROM events e
      JOIN triggers t ON t.triggerid = e.objectid
      JOIN functions f ON f.triggerid = t.triggerid
      JOIN items i ON i.itemid = f.itemid
      JOIN hosts h ON h.hostid = i.hostid
      WHERE e.source = 0
        AND h.templateid IS NULL
        AND h.flags = 0
        AND e.clock >= (SELECT MAX(clock) FROM events WHERE source = 0) - (30 * 24 * 3600)
      GROUP BY DATE(FROM_UNIXTIME(e.clock))
      ORDER BY day ASC
    `);
  }

  async getProblemsByHost(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.name as host_name,
        COUNT(t.triggerid) as problem_count
      FROM triggers t
      JOIN functions f ON f.triggerid = t.triggerid
      JOIN items i ON i.itemid = f.itemid
      JOIN hosts h ON h.hostid = i.hostid
      WHERE t.value = 1 
        AND t.status = 0
        AND h.templateid IS NULL
        AND h.flags = 0
      GROUP BY h.hostid, h.name
      ORDER BY problem_count DESC
      LIMIT 10
    `);
  }

  async getServiceAvailability(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.name as host,
        i.name as service_name,
        i.itemid,
        -- Current state
        (SELECT hu.value FROM history_uint hu 
         WHERE hu.itemid = i.itemid 
         ORDER BY hu.clock DESC LIMIT 1) as current_state,
        -- Number of incidents (non-zero values) in last 30 days
        (SELECT COUNT(DISTINCT DATE(FROM_UNIXTIME(hu.clock)))
         FROM history_uint hu
         WHERE hu.itemid = i.itemid
         AND hu.value != 0
        AND hu.clock >= (SELECT MAX(clock) FROM history_uint WHERE itemid = i.itemid) - (30 * 24 * 3600)
        ) as incident_days,
        -- Last incident time
        (SELECT FROM_UNIXTIME(MAX(hu.clock))
         FROM history_uint hu
         WHERE hu.itemid = i.itemid
         AND hu.value != 0
        AND hu.clock >= (SELECT MAX(clock) FROM history_uint WHERE itemid = i.itemid) - (30 * 24 * 3600)
        ) as last_incident
      FROM items i
      JOIN hosts h ON h.hostid = i.hostid
      WHERE i.itemid IN (
        64317, -- MSSQL$SAGE100
        64336, -- SQLAgent$SAGE100
        62724, -- NTDS
        62703, -- DNS
        62713, -- Kdc
        62721, -- Netlogon DC-SRV
        64319, -- Netlogon SAGE-SRV
        62753  -- vmms
      )
      ORDER BY h.name, i.name
    `);
  }

  async getAgentAvailability(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.name as host,
        -- Current availability (1=available, 2=unavailable, 0=unknown)
        (SELECT hu.value FROM history_uint hu
         WHERE hu.itemid = i.itemid
         ORDER BY hu.clock DESC LIMIT 1) as current_status,
        -- Average availability % over 30 days
        ROUND(
          (SELECT AVG(CASE WHEN hu.value = 1 THEN 1 ELSE 0 END) * 100
           FROM history_uint hu
           WHERE hu.itemid = i.itemid
           AND hu.clock >= (SELECT MAX(clock) FROM history_uint WHERE itemid = i.itemid) - (30 * 24 * 3600)
          ), 2
        ) as availability_pct
      FROM items i
      JOIN hosts h ON h.hostid = i.hostid
      WHERE i.itemid IN (
        62658, -- Zabbix agent availability DC-SRV
        64209  -- Zabbix agent availability SAGE-SRV
      )
      ORDER BY h.name
    `);
  }

  async getAgentAvailabilityStats(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.name as host,
        i.itemid,
        -- Current status
        (SELECT hu.value FROM history_uint hu
         WHERE hu.itemid = i.itemid
         ORDER BY hu.clock DESC LIMIT 1) as current_status,
        stats.availability_pct,
        stats.total_checks,
        stats.unavailable_checks,
        FROM_UNIXTIME(stats.last_unavailable_clock) as last_unavailable
      FROM items i
      JOIN hosts h ON h.hostid = i.hostid
      LEFT JOIN (
        SELECT
          hu.itemid,
          COUNT(*) as total_checks,
          SUM(CASE WHEN hu.value != 1 THEN 1 ELSE 0 END) as unavailable_checks,
          ROUND(AVG(CASE WHEN hu.value = 1 THEN 1.0 ELSE 0.0 END) * 100, 4) as availability_pct,
          MAX(CASE WHEN hu.value != 1 THEN hu.clock END) as last_unavailable_clock
        FROM history_uint hu
        JOIN (
          SELECT itemid, MAX(clock) as max_clock
          FROM history_uint
          WHERE itemid IN (62658, 64209)
          GROUP BY itemid
        ) bounds ON bounds.itemid = hu.itemid
         AND hu.clock >= bounds.max_clock - (30 * 24 * 3600)
        WHERE hu.itemid IN (62658, 64209)
        GROUP BY hu.itemid
      ) stats ON stats.itemid = i.itemid
      WHERE i.itemid IN (62658, 64209)
      ORDER BY h.name
    `);
  }

  async getAgentAvailabilityHistory(
    itemid: string,
    from?: number,
    to?: number,
  ): Promise<unknown[]> {
    const maxClockResult: any[] = await this.zabbixDataSource.query(
      `SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?`,
      [itemid],
    );
    const toTs =
      to ??
      (Number(maxClockResult[0]?.max_clock) || Math.floor(Date.now() / 1000));
    const fromTs = from ?? toTs - 30 * 24 * 60 * 60;

    return this.zabbixDataSource.query(
      `
      SELECT
        DATE(FROM_UNIXTIME(clock)) as day,
        ROUND(AVG(CASE WHEN value = 1 THEN 100.0 ELSE 0.0 END), 2) as availability_pct,
        SUM(CASE WHEN value != 1 THEN 1 ELSE 0 END) as outages
      FROM history_uint
      WHERE itemid = ?
        AND clock >= ?
        AND clock <= ?
      GROUP BY DATE(FROM_UNIXTIME(clock))
      ORDER BY day ASC
    `,
      [itemid, fromTs, toTs],
    );
  }

  async getAgentAvailablePeriods(
    itemid: string,
  ): Promise<{ year: number; month: number }[]> {
    const raw: Array<{ year: number | string; month: number | string }> =
      await this.zabbixDataSource.query(
        `
    SELECT
      YEAR(FROM_UNIXTIME(clock)) as year,
      MONTH(FROM_UNIXTIME(clock)) as month
    FROM history_uint
    WHERE itemid = ?
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    `,
        [itemid],
      );

    return raw.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));
  }

  async getUptimeStats(): Promise<unknown[]> {
    return this.zabbixDataSource.query(`
      SELECT /*+ MAX_EXECUTION_TIME(20000) */
        h.name as host,
        i.itemid,
        -- Current uptime in seconds (latest value)
        (SELECT hu.value FROM history_uint hu
         WHERE hu.itemid = i.itemid
         ORDER BY hu.clock DESC LIMIT 1) as current_uptime_seconds,
        -- Last restart time = when uptime last dropped below 300 seconds
        (SELECT FROM_UNIXTIME(hu.clock)
         FROM history_uint hu
         WHERE hu.itemid = i.itemid
         AND hu.value < 300
         AND hu.clock >= (SELECT MAX(clock) FROM history_uint WHERE itemid = i.itemid) - (30 * 24 * 3600)
         ORDER BY hu.clock ASC LIMIT 1) as last_restart_time,
        -- Number of restarts in 30 days
        (SELECT COUNT(DISTINCT DATE(FROM_UNIXTIME(hu.clock)))
         FROM history_uint hu
         WHERE hu.itemid = i.itemid
         AND hu.value < 300
         AND hu.clock >= (SELECT MAX(clock) FROM history_uint WHERE itemid = i.itemid) - (30 * 24 * 3600)
        ) as restart_count
      FROM items i
      JOIN hosts h ON h.hostid = i.hostid
      WHERE i.itemid IN (62651, 64202)
      ORDER BY h.name
    `);
  }

  async getUptimeHistory(
    itemid: string,
    from?: number,
    to?: number,
  ): Promise<unknown[]> {
    const maxClockResult: any[] = await this.zabbixDataSource.query(
      `SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?`,
      [itemid],
    );
    const toTs =
      to ??
      (Number(maxClockResult[0]?.max_clock) || Math.floor(Date.now() / 1000));
    const fromTs = from ?? toTs - 30 * 24 * 60 * 60;

    return this.zabbixDataSource.query(
      `
      SELECT
        DATE(FROM_UNIXTIME(clock)) as day,
        MAX(value) as max_uptime_seconds,
        MIN(value) as min_uptime_seconds,
        CASE WHEN MIN(value) < 300 THEN 1 ELSE 0 END as had_restart
      FROM history_uint
      WHERE itemid = ?
        AND clock >= ?
        AND clock <= ?
      GROUP BY DATE(FROM_UNIXTIME(clock))
      ORDER BY day ASC
    `,
      [itemid, fromTs, toTs],
    );
  }
  async getUptimeAvailablePeriods(
    itemid: string,
  ): Promise<{ year: number; month: number }[]> {
    const raw: Array<{ year: number | string; month: number | string }> =
      await this.zabbixDataSource.query(
        `
      SELECT
        YEAR(FROM_UNIXTIME(clock)) as year,
        MONTH(FROM_UNIXTIME(clock)) as month
      FROM history_uint
      WHERE itemid = ?
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `,
        [itemid],
      );
    return raw.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));
  }

  async getServiceHistory(
    itemid: string,
    from?: string,
    to?: string,
  ): Promise<{ time: string; value: number }[]> {
    let query = `
      SELECT
        hu.clock as clock,
        hu.value as value
      FROM history_uint hu
      WHERE hu.itemid = ?
    `;
    const params: any[] = [itemid];

    if (from !== undefined && from !== '') {
      query += ` AND hu.clock >= ?`;
      params.push(Number(from));
    } else {
      const maxClockResult: any[] = await this.zabbixDataSource.query(
        `
      SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?
    `,
        [itemid],
      );
      const maxClock =
        Number(maxClockResult[0]?.max_clock) || Math.floor(Date.now() / 1000);
      const defaultFrom = maxClock - 30 * 24 * 60 * 60;
      query += ` AND hu.clock >= ?`;
      params.push(defaultFrom);
    }

    if (to !== undefined && to !== '') {
      query += ` AND hu.clock <= ?`;
      params.push(Number(to));
    }

    query += ` ORDER BY hu.clock ASC`;

    const raw: Array<{ clock: number; value: number | string }> =
      await this.zabbixDataSource.query(query, params);
    return raw.map((row) => ({
      time: new Date(row.clock * 1000).toISOString(),
      value: Number(row.value),
    }));
  }

  async getServiceAvailablePeriods(
    itemid: string,
  ): Promise<{ year: number; month: number }[]> {
    const raw: Array<{ year: number | string; month: number | string }> =
      await this.zabbixDataSource.query(
        `
      SELECT 
        YEAR(FROM_UNIXTIME(clock)) as year,
        MONTH(FROM_UNIXTIME(clock)) as month
      FROM history_uint
      WHERE itemid = ?
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `,
        [itemid],
      );
    return raw.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));
  }

  // ─── SW-1 SFP Ports ───────────────────────────────────────────────

  getSfpPortsStats(): unknown[] {
    return this.sfpPortsCache;
  }

  private async computeSfpPortsStats(): Promise<unknown[]> {
    const SFP_ITEM_IDS = [68527, 68529, 68530];

    const items: any[] = await this.zabbixDataSource.query(
      `SELECT /*+ MAX_EXECUTION_TIME(5000) */ itemid, name, key_
       FROM items WHERE itemid IN (?)`,
      [SFP_ITEM_IDS],
    );

    const results: {
      port_name: string;
      itemid: number;
      port_number: number;
      last_value: number | null;
      min_value: number | null;
      avg_value: number | null;
      max_value: number | null;
      down_count: number;
      last_down: string | null;
    }[] = [];
    for (const item of items) {
      const latest = await this.latestHistoryUint(Number(item.itemid));

      let agg: Record<string, unknown> | null = null;
      if (latest) {
        const from = latest.clock - 30 * 24 * 3600;
        const rows: any[] = await this.zabbixDataSource.query(
          `SELECT /*+ MAX_EXECUTION_TIME(15000) */
             MIN(value) as min_value,
             MAX(value) as max_value,
             ROUND(AVG(value), 4) as avg_value,
             SUM(CASE WHEN value = 2 THEN 1 ELSE 0 END) as down_count,
             MAX(CASE WHEN value = 2 THEN clock END) as last_down_clock
           FROM history_uint
           WHERE itemid = ? AND clock >= ?`,
          [item.itemid, from],
        );
        agg = (rows[0] ?? null) as Record<string, unknown> | null;
      }

      results.push({
        port_name: String(item.name),
        itemid: Number(item.itemid),
        port_number: Number(String(item.key_).replace('ifOperStatus.', '')),
        last_value: latest ? latest.value : null,
        min_value: agg?.min_value != null ? Number(agg.min_value) : null,
        avg_value: agg?.avg_value != null ? Number(agg.avg_value) : null,
        max_value: agg?.max_value != null ? Number(agg.max_value) : null,
        down_count: agg?.down_count != null ? Number(agg.down_count) : 0,
        last_down:
          agg?.last_down_clock != null
            ? new Date(Number(agg.last_down_clock) * 1000).toISOString()
            : null,
      });
    }

    results.sort((a, b) => a.port_number - b.port_number);
    return results;
  }
  async getSfpPortHistory(
    itemid: string,
    from?: number,
    to?: number,
  ): Promise<unknown[]> {
    const maxClockResult: any[] = await this.zabbixDataSource.query(
      `SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?`,
      [itemid],
    );
    const toTs =
      to ??
      (Number(maxClockResult[0]?.max_clock) || Math.floor(Date.now() / 1000));
    const fromTs = from ?? toTs - 30 * 24 * 60 * 60;

    return this.zabbixDataSource.query(
      `
      SELECT
        DATE(FROM_UNIXTIME(clock)) as day,
        MIN(value) as min_value,
        MAX(value) as max_value,
        ROUND(AVG(value), 4) as avg_value,
        (SELECT hu2.value FROM history_uint hu2
         WHERE hu2.itemid = ?
         AND DATE(FROM_UNIXTIME(hu2.clock)) = DATE(FROM_UNIXTIME(clock))
         ORDER BY hu2.clock DESC LIMIT 1) as \`last_value\`
      FROM history_uint
      WHERE itemid = ?
        AND clock >= ?
        AND clock <= ?
      GROUP BY DATE(FROM_UNIXTIME(clock))
      ORDER BY day ASC
      `,
      [itemid, itemid, fromTs, toTs],
    );
  }

  async getSfpAvailablePeriods(
    itemid: string,
  ): Promise<{ year: number; month: number }[]> {
    const raw: Array<{ year: number | string; month: number | string }> =
      await this.zabbixDataSource.query(
        `
      SELECT
        YEAR(FROM_UNIXTIME(clock)) as year,
        MONTH(FROM_UNIXTIME(clock)) as month
      FROM history_uint
      WHERE itemid = ?
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      `,
        [itemid],
      );
    return raw.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));
  }

  // ─── Network Switches ─────────────────────────────────────────────

  getSwitchUptimeStats(): unknown[] {
    return this.switchUptimeCache;
  }

  private async computeSwitchUptimeStats(): Promise<unknown[]> {
    const UPTIME_ITEM_IDS = [68383, 68052, 67018, 67802, 68230, 67660];

    const items: any[] = await this.zabbixDataSource.query(
      `SELECT /*+ MAX_EXECUTION_TIME(5000) */
         i.itemid, i.hostid, h.name as switch_name
       FROM items i
       JOIN hosts h ON h.hostid = i.hostid
       WHERE i.itemid IN (?)
       ORDER BY h.name`,
      [UPTIME_ITEM_IDS],
    );

    // Latest status of every physical port on these switches, counted per
    // host — one indexed LIMIT-1 lookup per port instead of a correlated
    // subquery per port inside a GROUP BY over all of history_uint.
    const portCounts = new Map<
      number,
      { total: number; up: number; down: number }
    >();
    const hostids = [...new Set(items.map((r) => Number(r.hostid)))];
    if (hostids.length) {
      const portItems: any[] = await this.zabbixDataSource.query(
        `SELECT /*+ MAX_EXECUTION_TIME(5000) */ itemid, hostid
         FROM items
         WHERE hostid IN (?) AND key_ LIKE 'ifOperStatus.%'`,
        [hostids],
      );
      for (const p of portItems) {
        const hostid = Number(p.hostid);
        const entry = portCounts.get(hostid) ?? { total: 0, up: 0, down: 0 };
        entry.total += 1;
        const latest = await this.latestHistoryUint(Number(p.itemid));
        if (latest?.value === 1) entry.up += 1;
        else if (latest?.value === 2) entry.down += 1;
        portCounts.set(hostid, entry);
      }
    }

    const results: {
      switch_name: string;
      hostid: number;
      itemid: number;
      current_uptime_seconds: number | null;
      last_check: string | null;
      min_uptime_seconds: number | null;
      restart_count: number;
      last_restart_time: string | null;
      total_ports: number;
      up_ports: number;
      down_ports: number;
    }[] = [];
    for (const item of items) {
      const latest = await this.latestHistoryUint(Number(item.itemid));

      let agg: Record<string, unknown> | null = null;
      if (latest) {
        const from = latest.clock - 30 * 24 * 3600;
        const rows: any[] = await this.zabbixDataSource.query(
          `SELECT /*+ MAX_EXECUTION_TIME(15000) */
             MIN(value) as min_uptime_seconds,
             SUM(CASE WHEN value < 300 THEN 1 ELSE 0 END) as restart_count,
             MIN(CASE WHEN value < 300 THEN clock END) as last_restart_clock
           FROM history_uint
           WHERE itemid = ? AND clock >= ?`,
          [item.itemid, from],
        );
        agg = (rows[0] ?? null) as Record<string, unknown> | null;
      }

      const ports = portCounts.get(Number(item.hostid));
      results.push({
        switch_name: String(item.switch_name),
        hostid: Number(item.hostid),
        itemid: Number(item.itemid),
        current_uptime_seconds: latest ? latest.value : null,
        last_check: latest ? new Date(latest.clock * 1000).toISOString() : null,
        min_uptime_seconds:
          agg?.min_uptime_seconds != null
            ? Number(agg.min_uptime_seconds)
            : null,
        restart_count:
          agg?.restart_count != null ? Number(agg.restart_count) : 0,
        last_restart_time:
          agg?.last_restart_clock != null
            ? new Date(Number(agg.last_restart_clock) * 1000).toISOString()
            : null,
        total_ports: ports?.total ?? 0,
        up_ports: ports?.up ?? 0,
        down_ports: ports?.down ?? 0,
      });
    }
    return results;
  }

  async getSwitchUptimeHistory(
    itemid: string,
    from?: number,
    to?: number,
  ): Promise<unknown[]> {
    const maxClockResult: any[] = await this.zabbixDataSource.query(
      `SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?`,
      [itemid],
    );
    const toTs =
      to ??
      (Number(maxClockResult[0]?.max_clock) || Math.floor(Date.now() / 1000));
    const fromTs = from ?? toTs - 30 * 24 * 60 * 60;

    return this.zabbixDataSource.query(
      `
      SELECT
        DATE(FROM_UNIXTIME(clock)) as day,
        MAX(value) as max_uptime_seconds,
        MIN(value) as min_uptime_seconds,
        CASE WHEN MIN(value) < 300 THEN 1 ELSE 0 END as had_restart
      FROM history_uint
      WHERE itemid = ?
        AND clock >= ?
        AND clock <= ?
      GROUP BY DATE(FROM_UNIXTIME(clock))
      ORDER BY day ASC
      `,
      [itemid, fromTs, toTs],
    );
  }

  async getSwitchUptimeAvailablePeriods(
    itemid: string,
  ): Promise<{ year: number; month: number }[]> {
    const raw: Array<{ year: number | string; month: number | string }> =
      await this.zabbixDataSource.query(
        `
      SELECT
        YEAR(FROM_UNIXTIME(clock)) as year,
        MONTH(FROM_UNIXTIME(clock)) as month
      FROM history_uint
      WHERE itemid = ?
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      `,
        [itemid],
      );
    return raw.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
    }));
  }

  // ─── Report Charts (one call fetches all 30-day daily histories) ──────────

  private async getEffectiveFrom(
    itemid: number,
    fromTs: number,
  ): Promise<number> {
    const rows: any[] = await this.zabbixDataSource.query(
      `SELECT MAX(clock) as max_clock FROM history_uint WHERE itemid = ?`,
      [itemid],
    );
    const maxClock =
      Number(rows[0]?.max_clock) || Math.floor(Date.now() / 1000);
    // Anchor to max(clock) so that Zabbix collection gaps don't yield empty results
    return Math.min(fromTs, maxClock - 30 * 24 * 3600);
  }

  private async dailyHistUint(
    itemid: number,
    fromTs: number,
  ): Promise<{ day: string; min: number; max: number; avg: number }[]> {
    const effectiveFrom = await this.getEffectiveFrom(itemid, fromTs);
    const rows: any[] = await this.zabbixDataSource.query(
      `SELECT
         DATE_FORMAT(FROM_UNIXTIME(clock), '%Y-%m-%d') as day,
         MIN(value) as min,
         MAX(value) as max,
         ROUND(AVG(value), 4) as avg
       FROM history_uint
       WHERE itemid = ? AND clock >= ?
       GROUP BY DATE_FORMAT(FROM_UNIXTIME(clock), '%Y-%m-%d')
       ORDER BY day ASC`,
      [itemid, effectiveFrom],
    );
    return rows.map((r: any) => ({
      day: String(r.day),
      min: Number(r.min),
      max: Number(r.max),
      avg: Number(r.avg),
    }));
  }

  private async dailyAgentAvail(
    itemid: number,
    fromTs: number,
  ): Promise<{ day: string; avail_pct: number }[]> {
    const effectiveFrom = await this.getEffectiveFrom(itemid, fromTs);
    const rows: any[] = await this.zabbixDataSource.query(
      `SELECT
         DATE_FORMAT(FROM_UNIXTIME(clock), '%Y-%m-%d') as day,
         ROUND(AVG(CASE WHEN value = 1 THEN 100.0 ELSE 0.0 END), 2) as avail_pct
       FROM history_uint
       WHERE itemid = ? AND clock >= ?
       GROUP BY DATE_FORMAT(FROM_UNIXTIME(clock), '%Y-%m-%d')
       ORDER BY day ASC`,
      [itemid, effectiveFrom],
    );
    return rows.map((r: any) => ({
      day: String(r.day),
      avail_pct: Number(r.avail_pct),
    }));
  }

  async getReportCharts(): Promise<unknown> {
    const fromTs = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const SERVICE_DEFS = [
      {
        itemid: 64317,
        label: 'SAGE-SRV – État du service MSSQL$SAGE100',
        host: 'SAGE-SRV',
        type: 'service',
        service: 'MSSQL$SAGE100',
      },
      {
        itemid: 64336,
        label: 'SAGE-SRV – État du service SQLAgent$SAGE100',
        host: 'SAGE-SRV',
        type: 'service',
        service: 'SQLAgent$SAGE100',
      },
      {
        itemid: 64319,
        label: 'SAGE-SRV – État du service Netlogon',
        host: 'SAGE-SRV',
        type: 'service',
        service: 'Netlogon',
      },
      {
        itemid: 62724,
        label: 'DC-SRV – État du service NTDS (AD DS)',
        host: 'DC-SRV',
        type: 'service',
        service: 'NTDS',
      },
      {
        itemid: 62703,
        label: 'DC-SRV – État du service DNS',
        host: 'DC-SRV',
        type: 'service',
        service: 'DNS',
      },
      {
        itemid: 62713,
        label: 'DC-SRV – État du service KDC (Kerberos)',
        host: 'DC-SRV',
        type: 'service',
        service: 'KDC',
      },
      {
        itemid: 62721,
        label: 'DC-SRV – État du service Netlogon',
        host: 'DC-SRV',
        type: 'service',
        service: 'Netlogon',
      },
      {
        itemid: 62753,
        label: 'DC-SRV – État du service vmms (Hyper-V)',
        host: 'DC-SRV',
        type: 'service',
        service: 'vmms',
      },
    ];

    const UPTIME_DEFS = [
      {
        itemid: 64202,
        label: 'SAGE-SRV – Uptime (redémarrages)',
        host: 'SAGE-SRV',
        type: 'uptime',
        service: '',
      },
      {
        itemid: 62651,
        label: 'DC-SRV – Uptime (redémarrages)',
        host: 'DC-SRV',
        type: 'uptime',
        service: '',
      },
    ];

    const AGENT_DEFS = [
      {
        itemid: 64209,
        label: 'SAGE-SRV – Disponibilité agent Zabbix',
        host: 'SAGE-SRV',
        type: 'agent',
        service: '',
      },
      {
        itemid: 62658,
        label: 'DC-SRV – Disponibilité agent Zabbix',
        host: 'DC-SRV',
        type: 'agent',
        service: '',
      },
    ];

    const SFP_DEFS: {
      itemid: number;
      label: string;
      host: string;
      type: string;
      service: string;
    }[] = [
      {
        itemid: 64499,
        label: 'SW1 – Port SFP 49',
        host: 'SW1',
        type: 'sfp',
        service: '',
      },
      {
        itemid: 64501,
        label: 'SW1 – Port SFP 50',
        host: 'SW1',
        type: 'sfp',
        service: '',
      },
      {
        itemid: 64502,
        label: 'SW1 – Port SFP 51',
        host: 'SW1',
        type: 'sfp',
        service: '',
      },
    ];

    // Dynamic lookup for SW-AQ / SW-QVM SFP port 49
    const dynSfp: any[] = await this.zabbixDataSource.query(
      `SELECT i.itemid, h.name as switch_name
       FROM items i JOIN hosts h ON h.hostid = i.hostid
       WHERE h.name IN ('SW-AQ','SW-QVM') AND i.key_ LIKE 'ifOperStatus.49'
       ORDER BY h.name`,
    );
    dynSfp.forEach((r: any) => {
      SFP_DEFS.push({
        itemid: Number(r.itemid),
        label: `${String(r.switch_name)} – Port SFP 49`,
        host: String(r.switch_name),
        type: 'sfp',
        service: '',
      });
    });

    // Switch uptimes — one representative item per switch host
    const swRows: any[] = await this.zabbixDataSource.query(
      `SELECT i.itemid, h.name as switch_name
       FROM items i JOIN hosts h ON h.hostid = i.hostid
       WHERE i.itemid IN (68383,68052,67018,67802,68230,67660)
       ORDER BY h.name, i.itemid`,
    );
    const seenSw = new Set<string>();
    const SWITCH_DEFS: {
      itemid: number;
      label: string;
      host: string;
      type: string;
      service: string;
    }[] = [];
    swRows.forEach((r: any) => {
      if (!seenSw.has(String(r.switch_name))) {
        seenSw.add(String(r.switch_name));
        SWITCH_DEFS.push({
          itemid: Number(r.itemid),
          label: `${String(r.switch_name)} – Uptime`,
          host: String(r.switch_name),
          type: 'switch_uptime',
          service: '',
        });
      }
    });

    const [services, uptimes, agents, sfpPorts, switchUptimes] =
      await Promise.all([
        Promise.all(
          SERVICE_DEFS.map(async (d) => ({
            ...d,
            data: await this.dailyHistUint(d.itemid, fromTs),
          })),
        ),
        Promise.all(
          UPTIME_DEFS.map(async (d) => ({
            ...d,
            data: await this.dailyHistUint(d.itemid, fromTs),
          })),
        ),
        Promise.all(
          AGENT_DEFS.map(async (d) => ({
            ...d,
            data: await this.dailyAgentAvail(d.itemid, fromTs),
          })),
        ),
        Promise.all(
          SFP_DEFS.map(async (d) => ({
            ...d,
            data: await this.dailyHistUint(d.itemid, fromTs),
          })),
        ),
        Promise.all(
          SWITCH_DEFS.map(async (d) => ({
            ...d,
            data: await this.dailyHistUint(d.itemid, fromTs),
          })),
        ),
      ]);

    return { services, uptimes, agents, sfpPorts, switchUptimes };
  }
}
