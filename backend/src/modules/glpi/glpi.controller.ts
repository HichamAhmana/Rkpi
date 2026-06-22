import { Controller, Get, Query } from '@nestjs/common';
import { GlpiService } from './glpi.service';
import { KpiSummaryResponseDto } from './dto/kpi-summary.dto';
import { TicketVolumeDto } from './dto/ticket-volume.dto';
import { TimeTrendsDto } from './dto/time-trends.dto';

@Controller('glpi')
export class GlpiController {
  constructor(private readonly glpiService: GlpiService) {}

  @Get('kpi-summary')
  async getKpiSummary(
    @Query('month') month?: string,
  ): Promise<KpiSummaryResponseDto> {
    // If month is not specified, default to '2026-04' to ensure consistent fallback behavior
    const targetMonth = month || '2026-04';
    return this.glpiService.getKpiSummary(targetMonth);
  }

  @Get('ticket-volume')
  async getTicketVolume(): Promise<TicketVolumeDto[]> {
    return this.glpiService.getTicketVolume();
  }

  @Get('time-trends')
  async getTimeTrends(): Promise<TimeTrendsDto> {
    return this.glpiService.getTimeTrends();
  }
}
