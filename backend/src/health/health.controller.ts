import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource('zabbix')
    private readonly zabbixDataSource: DataSource,
  ) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.zabbixDataSource.query(
        'SELECT /*+ MAX_EXECUTION_TIME(2000) */ 1',
      );
      return { status: 'ok' };
    } catch {
      throw new HttpException(
        { status: 'error', reason: 'zabbix db unreachable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
