import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZabbixService } from './zabbix.service';

@Controller('zabbix')
export class ZabbixController {
  constructor(private readonly zabbixService: ZabbixService) {}

  @Get('ping')
  ping() {
    return this.zabbixService.ping();
  }

  @Get('hosts')
  getHosts() {
    return this.zabbixService.getHosts();
  }

  @Get('host-stats')
  getHostStats() {
    return this.zabbixService.getHostStats();
  }

  @Get('trigger-stats')
  getTriggerStats() {
    return this.zabbixService.getTriggerStats();
  }

  @Get('recent-events')
  getRecentEvents() {
    return this.zabbixService.getRecentEvents();
  }

  @Get('events-by-day')
  getEventsByDay() {
    return this.zabbixService.getEventsByDay();
  }

  @Get('problems-by-host')
  getProblemsByHost() {
    return this.zabbixService.getProblemsByHost();
  }

  @Get('cpu-stats')
  getCpuStats() {
    return this.zabbixService.getCpuStats();
  }

  @Get('cpu-details')
  getCpuDetails() {
    return this.zabbixService.getCpuDetails();
  }

  @Get('service-availability')
  getServiceAvailability() {
    return this.zabbixService.getServiceAvailability();
  }

  @Get('agent-availability')
  getAgentAvailability() {
    return this.zabbixService.getAgentAvailability();
  }

  @Get('service-history/:itemid')
  getServiceHistory(
    @Param('itemid') itemid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zabbixService.getServiceHistory(itemid, from, to);
  }

  @Get('service-available-periods/:itemid')
  getServiceAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getServiceAvailablePeriods(itemid);
  }

  @Get('agent-availability-stats')
  getAgentAvailabilityStats() {
    return this.zabbixService.getAgentAvailabilityStats();
  }

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

  @Get('agent-available-periods/:itemid')
  getAgentAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getAgentAvailablePeriods(itemid);
  }

  @Get('uptime-stats')
  getUptimeStats() {
    return this.zabbixService.getUptimeStats();
  }

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

  @Get('uptime-available-periods/:itemid')
  getUptimeAvailablePeriods(@Param('itemid') itemid: string) {
    return this.zabbixService.getUptimeAvailablePeriods(itemid);
  }
}
