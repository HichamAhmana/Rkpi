import { IKpiSummary } from '../interfaces/glpi-kpi.interface';

export class GetKpiSummaryQueryDto {
  month: string;
}

export class KpiSummaryResponseDto implements IKpiSummary {
  month: string;
  ticketsCreated: number;
  ticketsClosed: number;
  resolutionRate: number;
  timeToOwn: number;
  timeToClose: number;
}
