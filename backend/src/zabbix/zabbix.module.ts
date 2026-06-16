import { Module } from '@nestjs/common';
import { ZabbixService } from './zabbix.service';
import { ZabbixController } from './zabbix.controller';

@Module({
  controllers: [ZabbixController],
  providers: [ZabbixService],
})
export class ZabbixModule {}
