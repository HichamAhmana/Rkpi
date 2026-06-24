import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZabbixModule } from './zabbix/zabbix.module';
import { GlpiModule } from './modules/glpi/glpi.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      name: 'zabbix',
      type: 'mysql',
      host: process.env.DB_ZABBIX_HOST ?? 'localhost',
      port: parseInt(process.env.DB_ZABBIX_PORT ?? '3308'),
      username: process.env.DB_ZABBIX_USER ?? 'reporter',
      password: process.env.DB_ZABBIX_PASSWORD ?? 'reporterpass',
      database: process.env.DB_ZABBIX_NAME ?? 'zabbix',
      synchronize: false,
      autoLoadEntities: true,
    }),
    TypeOrmModule.forRoot({
      name: 'glpi',
      type: 'mysql',
      host: process.env.DB_GLPI_HOST ?? 'localhost',
      port: parseInt(process.env.DB_GLPI_PORT ?? '3307'),
      username: process.env.DB_GLPI_USER ?? 'reporter',
      password: process.env.DB_GLPI_PASSWORD ?? 'reporterpass',
      database: process.env.DB_GLPI_NAME ?? 'glpi',
      synchronize: false,
      autoLoadEntities: true,
    }),
    ZabbixModule,
    GlpiModule,
  ],
})
export class AppModule {}
