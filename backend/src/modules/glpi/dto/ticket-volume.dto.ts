import { ITicketVolume } from '../interfaces/glpi-kpi.interface';

export class TicketVolumeDto implements ITicketVolume {
  month: string;
  tickets: number;
}
