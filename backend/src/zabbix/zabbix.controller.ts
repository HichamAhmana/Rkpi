import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ZabbixService } from './zabbix.service';

const MIN = 60_000;

@UseInterceptors(CacheInterceptor)
@Controller('zabbix')
export class ZabbixController {
  constructor(private readonly zabbixService: ZabbixService) {}

  @Get('ping')
  ping() {
    return this.zabbixService.ping();
  }

  @CacheTTL(1 * MIN)
  @Get('hosts')
  getHosts() {
    return this.zabbixService.getHosts();
  }

  @CacheTTL(1 * MIN)
  @Get('host-stats')
  getHostStats() {
    return this.zabbixService.getHostStats();
  }

  @CacheTTL(1 * MIN)
  @Get('trigger-stats')
  getTriggerStats() {
    return this.zabbixService.getTriggerStats();
  }

  @CacheTTL(1 * MIN)
  @Get('recent-events')
  getRecentEvents() {
    return this.zabbixService.getRecentEvents();
  }

  @CacheTTL(5 * MIN)
  @Get('events-by-day')
  getEventsByDay() {
    return this.zabbixService.getEventsByDay();
  }

  @CacheTTL(2 * MIN)
  @Get('problems-by-host')
  getProblemsByHost() {
    return this.zabbixService.getProblemsByHost();
  }

  @CacheTTL(1 * MIN)
  @Get('cpu-stats')
  getCpuStats() {
    return this.zabbixService.getCpuStats();
  }

  @CacheTTL(1 * MIN)
  @Get('cpu-details')
  getCpuDetails() {
    return this.zabbixService.getCpuDetails();
  }

  @CacheTTL(2 * MIN)
  @Get('service-availability')
  getServiceAvailability() {
    return this.zabbixService.getServiceAvailability();
  }

  @CacheTTL(2 * MIN)
  @Get('agent-availability')
  getAgentAvailability() {
    return this.zabbixService.getAgentAvailability();
  }

  @CacheTTL(5 * MIN)
  @Get('service-history/:itemid')
  getServiceHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getServiceHistory(itemid, from, to);
  }

  @CacheTTL(10 * MIN)
  @Get('service-available-periods/:itemid')
  getServiceAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getServiceAvailablePeriods(itemid);
  }

  @CacheTTL(2 * MIN)
  @Get('agent-availability-stats')
  getAgentAvailabilityStats() {
    return this.zabbixService.getAgentAvailabilityStats();
  }

  @CacheTTL(5 * MIN)
  @Get('agent-availability-history/:itemid')
  getAgentAvailabilityHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getAgentAvailabilityHistory(
      itemid,
      from ? parseInt(from) : undefined,
      to ? parseInt(to) : undefined,
    );
  }

  @CacheTTL(10 * MIN)
  @Get('agent-available-periods/:itemid')
  getAgentAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getAgentAvailablePeriods(itemid);
  }

  @CacheTTL(2 * MIN)
  @Get('uptime-stats')
  getUptimeStats() {
    return this.zabbixService.getUptimeStats();
  }

  @CacheTTL(5 * MIN)
  @Get('uptime-history/:itemid')
  getUptimeHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getUptimeHistory(
      itemid,
      from ? parseInt(from) : undefined,
      to ? parseInt(to) : undefined,
    );
  }

  @CacheTTL(10 * MIN)
  @Get('uptime-available-periods/:itemid')
  getUptimeAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getUptimeAvailablePeriods(itemid);
  }

  @CacheTTL(2 * MIN)
  @Get('sfp-ports-stats')
  getSfpPortsStats() {
    return this.zabbixService.getSfpPortsStats();
  }

  @CacheTTL(5 * MIN)
  @Get('sfp-port-history/:itemid')
  getSfpPortHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getSfpPortHistory(
      itemid,
      from ? parseInt(from) : undefined,
      to ? parseInt(to) : undefined,
    );
  }

  @CacheTTL(10 * MIN)
  @Get('sfp-available-periods/:itemid')
  getSfpAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getSfpAvailablePeriods(itemid);
  }

  @CacheTTL(2 * MIN)
  @Get('switch-uptime-stats')
  getSwitchUptimeStats() {
    return this.zabbixService.getSwitchUptimeStats();
  }

  @CacheTTL(5 * MIN)
  @Get('switch-uptime-history/:itemid')
  getSwitchUptimeHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getSwitchUptimeHistory(
      itemid,
      from ? parseInt(from) : undefined,
      to ? parseInt(to) : undefined,
    );
  }

  @CacheTTL(10 * MIN)
  @Get('switch-uptime-periods/:itemid')
  getSwitchUptimeAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getSwitchUptimeAvailablePeriods(itemid);
  }

  // Heavy endpoint: fires ~30 queries — cache aggressively
  @CacheTTL(10 * MIN)
  @Get('report-charts')
  getReportCharts() {
    return this.zabbixService.getReportCharts();
  }
}
