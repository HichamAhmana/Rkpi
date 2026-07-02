import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { ZabbixModule } from '../../zabbix/zabbix.module';
import { GlpiModule } from '../glpi/glpi.module';

// Same GLPI-optional gate as AppModule — GlpiModule needs the 'glpi'
// TypeOrmModule connection to be registered, which only happens when
// DB_GLPI_HOST is set. See app.module.ts for the full rationale.
const glpiEnabled = Boolean(process.env.DB_GLPI_HOST);

@Module({
  imports: [ZabbixModule, ...(glpiEnabled ? [GlpiModule] : [])],
  controllers: [EmailController],
  providers: [EmailService],
})
export class EmailModule {}
