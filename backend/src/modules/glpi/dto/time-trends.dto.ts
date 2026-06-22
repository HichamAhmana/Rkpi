import { ITimeTrendPoint, ITimeTrends } from '../interfaces/glpi-kpi.interface';

export class TimeTrendPointDto implements ITimeTrendPoint {
  month: string;
  value: number;
}

export class TimeTrendsDto implements ITimeTrends {
  timeToOwn: TimeTrendPointDto[];
  timeToClose: TimeTrendPointDto[];
}
