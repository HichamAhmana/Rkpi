import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KpiSummaryResponseDto } from './dto/kpi-summary.dto';
import { TicketVolumeDto } from './dto/ticket-volume.dto';
import { TimeTrendsDto } from './dto/time-trends.dto';

@Injectable()
export class GlpiService {
  constructor(
    @InjectDataSource('glpi')
    private glpiDataSource: DataSource,
  ) {}

  /**
   * Retrieves KPI Summary for a specific month
   * @param month Month in YYYY-MM format
   * @param type Ticket type filter: 1 = Incident, 2 = Demand, undefined = All
   */
  async getKpiSummary(month: string, type?: number): Promise<KpiSummaryResponseDto> {
    const params: any[] = [];
    let monthFilter = '';
    
    if (month !== 'all') {
      monthFilter = "DATE_FORMAT(date, '%Y-%m') = ?";
      params.push(month);
    } else {
      monthFilter = '1 = 1'; // Skip month filtering to aggregate all months
    }

    let typeFilter = '';
    if (type !== undefined && type !== null) {
      typeFilter = 'AND type = ?';
      params.push(type);
    }

    const rows = await this.glpiDataSource.query(`
      SELECT 
        COUNT(id) as ticketsCreated,
        SUM(CASE WHEN status IN (5, 6) THEN 1 ELSE 0 END) as ticketsClosed,
        IF(COUNT(id) > 0, (SUM(CASE WHEN status IN (5, 6) THEN 1 ELSE 0 END) / COUNT(id)) * 100, 0) as resolutionRate,
        AVG(TIMESTAMPDIFF(SECOND, date_creation, takeintoaccountdate)) / 3600 as timeToOwn,
        AVG(TIMESTAMPDIFF(SECOND, date, solvedate)) / 3600 as timeToClose
      FROM glpi_tickets
      WHERE ${monthFilter} 
        AND is_deleted = 0
        ${typeFilter}
    `, params);

    const row = rows[0] || {};
    return {
      month,
      ticketsCreated: Number(row.ticketsCreated || 0),
      ticketsClosed: Number(row.ticketsClosed || 0),
      resolutionRate: parseFloat(Number(row.resolutionRate || 0).toFixed(1)),
      timeToOwn: parseFloat(Number(row.timeToOwn || 0).toFixed(1)),
      timeToClose: parseFloat(Number(row.timeToClose || 0).toFixed(1)),
    };
  }

  /**
   * Retrieves ticket volume trends over the months
   * @param type Ticket type filter: 1 = Incident, 2 = Demand, undefined = All
   */
  async getTicketVolume(type?: number): Promise<TicketVolumeDto[]> {
    const params: any[] = [];
    let typeFilter = '';
    if (type !== undefined && type !== null) {
      typeFilter = 'AND type = ?';
      params.push(type);
    }

    const rows = await this.glpiDataSource.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        COUNT(id) as tickets
      FROM glpi_tickets
      WHERE is_deleted = 0
        ${typeFilter}
      GROUP BY month
      ORDER BY month ASC
    `, params);

    return rows.map(r => ({
      month: r.month,
      tickets: Number(r.tickets || 0),
    }));
  }

  /**
   * Retrieves time to own and time to close trends over the months
   * @param type Ticket type filter: 1 = Incident, 2 = Demand, undefined = All
   */
  async getTimeTrends(type?: number): Promise<TimeTrendsDto> {
    const params: any[] = [];
    let typeFilter = '';
    if (type !== undefined && type !== null) {
      typeFilter = 'AND type = ?';
      params.push(type);
    }

    const rows = await this.glpiDataSource.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        AVG(TIMESTAMPDIFF(SECOND, date_creation, takeintoaccountdate)) / 3600 as timeToOwn,
        AVG(TIMESTAMPDIFF(SECOND, date, solvedate)) / 3600 as timeToClose
      FROM glpi_tickets
      WHERE is_deleted = 0
        ${typeFilter}
      GROUP BY month
      ORDER BY month ASC
    `, params);

    return {
      timeToOwn: rows.map(r => ({
        month: r.month,
        value: parseFloat(Number(r.timeToOwn || 0).toFixed(1)),
      })),
      timeToClose: rows.map(r => ({
        month: r.month,
        value: parseFloat(Number(r.timeToClose || 0).toFixed(1)),
      })),
    };
  }
}
