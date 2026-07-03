import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ZabbixModule } from './zabbix/zabbix.module';
import { GlpiModule } from './modules/glpi/glpi.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

// GLPI's database may not be reachable yet (e.g. it lives on a VM that isn't
// set up). Skip registering its connection entirely rather than crashing the
// whole backend on boot — Zabbix-only deployments stay functional this way.
const glpiEnabled = Boolean(process.env.DB_GLPI_HOST);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 60_000, max: 200 }),
    ScheduleModule.forRoot(),
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
      extra: { connectionLimit: 10 },
    }),
    ...(glpiEnabled
      ? [
          TypeOrmModule.forRoot({
            name: 'glpi',
            type: 'mysql',
            host: process.env.DB_GLPI_HOST,
            port: parseInt(process.env.DB_GLPI_PORT ?? '3307'),
            username: process.env.DB_GLPI_USER ?? 'reporter',
            password: process.env.DB_GLPI_PASSWORD ?? 'reporterpass',
            database: process.env.DB_GLPI_NAME ?? 'glpi',
            synchronize: false,
            autoLoadEntities: true,
            extra: { connectionLimit: 5 },
          }),
        ]
      : []),
    ZabbixModule,
    ...(glpiEnabled ? [GlpiModule] : []),
    EmailModule,
    AuthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
