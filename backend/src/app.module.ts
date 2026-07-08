import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { ZabbixModule } from './zabbix/zabbix.module';
import { GlpiModule } from './modules/glpi/glpi.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthModule } from './health/health.module';

// GLPI's database may not be reachable yet (e.g. it lives on a VM that isn't
// set up). Skip registering its connection entirely rather than crashing the
// whole backend on boot — Zabbix-only deployments stay functional this way.
const glpiEnabled = Boolean(process.env.DB_GLPI_HOST);

@Module({
  imports: [
    SentryModule.forRoot(),
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
      // queueLimit caps how many requests can be waiting for a free pooled
      // connection at once — beyond that they fail immediately instead of
      // queueing forever. MAX_EXECUTION_TIME query hints only bound a query
      // once it's already running, they don't help if every connection is stuck.
      // resetOnRelease clears session state (temp tables, leftover locks,
      // interrupted-query residue) before a connection goes back into the
      // pool — without it, a connection killed by MAX_EXECUTION_TIME could
      // come back in a bad state and make the *next*, unrelated query on
      // that same connection fail too.
      extra: { connectionLimit: 10, queueLimit: 20, resetOnRelease: true },
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
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
