import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { GlpiService } from './glpi.service';
import { KpiSummaryResponseDto } from './dto/kpi-summary.dto';
import { TicketVolumeDto } from './dto/ticket-volume.dto';
import { TimeTrendsDto } from './dto/time-trends.dto';

const MIN = 60_000;

@UseInterceptors(CacheInterceptor)
@Controller('glpi')
export class GlpiController {
  constructor(private readonly glpiService: GlpiService) {}

  @CacheTTL(5 * MIN)
  @Get('kpi-summary')
  async getKpiSummary(
    @Query('month') month?: string,
    @Query('type') type?: string,
  ): Promise<KpiSummaryResponseDto> {
    // If month is not specified, default to '2026-04' to ensure consistent fallback behavior
    const targetMonth = month || '2026-04';
    const parsedType = type ? parseInt(type, 10) : undefined;
    return this.glpiService.getKpiSummary(targetMonth, parsedType);
  }

  @CacheTTL(5 * MIN)
  @Get('ticket-volume')
  async getTicketVolume(
    @Query('type') type?: string,
  ): Promise<TicketVolumeDto[]> {
    const parsedType = type ? parseInt(type, 10) : undefined;
    return this.glpiService.getTicketVolume(parsedType);
  }

  @CacheTTL(5 * MIN)
  @Get('time-trends')
  async getTimeTrends(
    @Query('type') type?: string,
  ): Promise<TimeTrendsDto> {
    const parsedType = type ? parseInt(type, 10) : undefined;
    return this.glpiService.getTimeTrends(parsedType);
  }
}
