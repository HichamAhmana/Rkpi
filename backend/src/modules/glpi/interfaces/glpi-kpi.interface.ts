export interface IKpiSummary {
  month: string;
  ticketsCreated: number;
  ticketsClosed: number;
  resolutionRate: number;
  timeToOwn: number;
  timeToClose: number;
}

export interface ITicketVolume {
  month: string;
  tickets: number;
}

export interface ITimeTrendPoint {
  month: string;
  value: number;
}

export interface ITimeTrends {
  timeToOwn: ITimeTrendPoint[];
  timeToClose: ITimeTrendPoint[];
}
