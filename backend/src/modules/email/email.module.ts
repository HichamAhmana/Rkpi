import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { ZabbixModule } from '../../zabbix/zabbix.module';
import { GlpiModule } from '../glpi/glpi.module';

@Module({
  imports: [ZabbixModule, GlpiModule],
  controllers: [EmailController],
  providers: [EmailService],
})
export class EmailModule {}
