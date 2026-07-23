import axios from 'axios';

const TOKEN_KEY = 'rkpi_token';

const authInterceptor = (config: import('axios').InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

const unauthorizedInterceptor = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
  return Promise.reject(error);
};

const api = axios.create({ baseURL: '/zabbix' });
const glpiApi = axios.create({ baseURL: '/glpi' });

[api, glpiApi].forEach(instance => {
  instance.interceptors.request.use(authInterceptor);
  instance.interceptors.response.use(undefined, unauthorizedInterceptor);
});

// ─── Existing Interfaces ───────────────────────────────────────────

export interface HostStats {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  disabled: number;
  in_maintenance: number;
}

export interface TriggerStats {
  total: number;
  problem: number;
  ok: number;
  disaster: number;
  high: number;
  average: number;
  warning: number;
  info: number;
}

export interface RecentEvent {
  eventid: string;
  clock: number;
  name: string;
  severity: number;
  value: number;
  acknowledged: number;
  event_time: string;
  host_name: string;
}

export interface EventByDay {
  day: string;
  total: number;
  problems: number;
  resolved: number;
}

export interface ProblemByHost {
  host_name: string;
  problem_count: number;
}

// ─── New Interfaces ────────────────────────────────────────────────

export interface ServiceItem {
  service_name: string;
  itemid: number;
  current_state: string;
  incident_days: number;
  last_incident: string | null;
  availability_pct: number;
}

export interface ServerServices {
  server_name: string;
  services: ServiceItem[];
}

export interface AgentAvailability {
  host_name: string;
  availability: number;
}

export interface AvailablePeriod {
  year: number;
  month: number;
}

export interface AgentStat {
  host: string;
  itemid: number;
  current_status: string | number;
  availability_pct: string | number;
  total_checks: number;
  unavailable_checks: number;
  last_unavailable: string | null;
}

export interface AgentHistoryPoint {
  day: string;
  availability_pct: string | number;
  outages: string | number;
}

export interface UptimeStat {
  host: string;
  itemid: number;
  current_uptime_seconds: number;
  last_restart_time: string | null;
  restart_count: number;
  availability_pct: number;
}

export interface UptimeHistoryPoint {
  day: string;
  max_uptime_seconds: number;
  min_uptime_seconds: number;
  had_restart: number;
}

export interface AvailablePeriod {
  year: number;
  month: number;
}

export interface HistoryPoint {
  time: string;
  value: number;
}

// ─── Existing API Functions ────────────────────────────────────────

export const getHostStats = async (): Promise<HostStats> => {
  const { data } = await api.get<HostStats>('/host-stats');
  return data;
};

export const getTriggerStats = async (): Promise<TriggerStats> => {
  const { data } = await api.get<TriggerStats>('/trigger-stats');
  return data;
};

export const getRecentEvents = async (): Promise<RecentEvent[]> => {
  const { data } = await api.get<RecentEvent[]>('/recent-events');
  return data;
};

export const getEventsByDay = async (): Promise<EventByDay[]> => {
  const { data } = await api.get<EventByDay[]>('/events-by-day');
  return data;
};

export const getProblemsByHost = async (): Promise<ProblemByHost[]> => {
  const { data } = await api.get<ProblemByHost[]>('/problems-by-host');
  return data;
};

// ─── New API Functions ─────────────────────────────────────────────

export const getServiceAvailability = async (): Promise<ServerServices[]> => {
  const { data } = await api.get<any[]>('/service-availability');
  const grouped: { [key: string]: ServiceItem[] } = {};

  data.forEach((item) => {
    const host = item.host || 'Unknown';
    if (!grouped[host]) {
      grouped[host] = [];
    }

    grouped[host].push({
      service_name: item.service_name,
      itemid: Number(item.itemid),
      current_state: String(item.current_state !== null && item.current_state !== undefined ? item.current_state : ''),
      incident_days: Number(item.incident_days || 0),
      last_incident: item.last_incident,
      availability_pct: item.availability_pct !== null && item.availability_pct !== undefined ? Number(item.availability_pct) : 0,
    });
  });

  return Object.keys(grouped).map((server_name) => ({
    server_name,
    services: grouped[server_name],
  }));
};

export const getAgentAvailability = async (): Promise<AgentAvailability[]> => {
  const { data } = await api.get<any[]>('/agent-availability');
  return data.map((item) => ({
    host_name: item.host || 'Unknown',
    availability: item.availability_pct !== null && item.availability_pct !== undefined ? Number(item.availability_pct) : 0,
  }));
};

export const getServiceHistory = async (itemid: number, from?: number, to?: number): Promise<HistoryPoint[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from.toString());
  if (to) params.append('to', to.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get<HistoryPoint[]>(`/service-history/${itemid}${query}`);
  return data;
};

export const getServiceAvailablePeriods = async (itemid: number): Promise<AvailablePeriod[]> => {
  const { data } = await api.get<AvailablePeriod[]>(`/service-available-periods/${itemid}`);
  return data;
};

export const getAgentAvailabilityStats = async (): Promise<AgentStat[]> => {
  const { data } = await api.get<AgentStat[]>('/agent-availability-stats');
  return data;
};

export const getAgentAvailabilityHistory = async (itemid: number, from?: number, to?: number): Promise<AgentHistoryPoint[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from.toString());
  if (to) params.append('to', to.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get<AgentHistoryPoint[]>(`/agent-availability-history/${itemid}${query}`);
  return data;
};

export const getAgentAvailablePeriods = async (itemid: number): Promise<AvailablePeriod[]> => {
  const { data } = await api.get<AvailablePeriod[]>(`/agent-available-periods/${itemid}`);
  return data;
};

export const getUptimeStats = async (): Promise<UptimeStat[]> => {
  const { data } = await api.get<UptimeStat[]>('/uptime-stats');
  return data;
};

export const getUptimeHistory = async (itemid: number, from?: number, to?: number): Promise<UptimeHistoryPoint[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from.toString());
  if (to) params.append('to', to.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get<UptimeHistoryPoint[]>(`/uptime-history/${itemid}${query}`);
  return data;
};

export const getUptimeAvailablePeriods = async (itemid: number): Promise<AvailablePeriod[]> => {
  const { data } = await api.get<AvailablePeriod[]>(`/uptime-available-periods/${itemid}`);
  return data;
};

// ─── SFP Ports Interfaces ───────────────────────────────────────────────

export interface SfpPortStat {
  port_name: string;
  host: string;
  itemid: number;
  port_number: number;
  last_value: number | string | null;
  min_value: number | string | null;
  avg_value: number | string | null;
  max_value: number | string | null;
  down_count: number | string;
  last_down: string | null;
}

export interface SfpHistoryPoint {
  day: string;
  min_value: number | string;
  max_value: number | string;
  avg_value: number | string;
  last_value: number | string | null;
}

// ─── SFP Ports API Functions ─────────────────────────────────────────────

export const getSfpPortsStats = async (): Promise<SfpPortStat[]> => {
  const { data } = await api.get<any[]>('/sfp-ports-stats');
  return data.map((item) => ({
    port_name: item.port_name || '',
    host: item.host || '',
    itemid: Number(item.itemid),
    port_number: Number(item.port_number),
    last_value: item.last_value !== null && item.last_value !== undefined ? Number(item.last_value) : null,
    min_value: item.min_value !== null && item.min_value !== undefined ? Number(item.min_value) : null,
    avg_value: item.avg_value !== null && item.avg_value !== undefined ? Number(item.avg_value) : null,
    max_value: item.max_value !== null && item.max_value !== undefined ? Number(item.max_value) : null,
    down_count: Number(item.down_count || 0),
    last_down: item.last_down || null,
  }));
};

export const getSfpPortHistory = async (itemid: number, from?: number, to?: number): Promise<SfpHistoryPoint[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from.toString());
  if (to) params.append('to', to.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get<any[]>(`/sfp-port-history/${itemid}${query}`);
  return data.map((item) => ({
    day: item.day,
    min_value: Number(item.min_value),
    max_value: Number(item.max_value),
    avg_value: Number(item.avg_value),
    last_value: item.last_value !== null && item.last_value !== undefined ? Number(item.last_value) : null,
  }));
};

export const getSfpAvailablePeriods = async (itemid: number): Promise<AvailablePeriod[]> => {
  const { data } = await api.get<AvailablePeriod[]>(`/sfp-available-periods/${itemid}`);
  return data;
};

// ─── Switch Uptime Interfaces ───────────────────────────────────────────

export interface SwitchUptimeStat {
  switch_name: string;
  hostid: number;
  itemid: number;
  current_uptime_seconds: number;
  last_check: string | null;
  min_uptime_seconds: number | null;
  restart_count: number;
  last_restart_time: string | null;
  total_ports: number;
  up_ports: number;
  down_ports: number;
}

export interface SwitchUptimeHistoryPoint {
  day: string;
  max_uptime_seconds: number;
  min_uptime_seconds: number;
  had_restart: number;
}

// ─── Switch Uptime API Functions ────────────────────────────────────────

export const getSwitchUptimeStats = async (): Promise<SwitchUptimeStat[]> => {
  const { data } = await api.get<any[]>('/switch-uptime-stats');
  return data.map((item) => ({
    switch_name: item.switch_name || '',
    hostid: Number(item.hostid),
    itemid: Number(item.itemid),
    current_uptime_seconds: Number(item.current_uptime_seconds || 0),
    last_check: item.last_check || null,
    min_uptime_seconds: item.min_uptime_seconds !== null && item.min_uptime_seconds !== undefined
      ? Number(item.min_uptime_seconds)
      : null,
    restart_count: Number(item.restart_count || 0),
    last_restart_time: item.last_restart_time || null,
    total_ports: Number(item.total_ports || 0),
    up_ports: Number(item.up_ports || 0),
    down_ports: Number(item.down_ports || 0),
  }));
};

export const getSwitchUptimeHistory = async (itemid: number, from?: number, to?: number): Promise<SwitchUptimeHistoryPoint[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from.toString());
  if (to) params.append('to', to.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get<any[]>(`/switch-uptime-history/${itemid}${query}`);
  return data.map((item) => ({
    day: item.day,
    max_uptime_seconds: Number(item.max_uptime_seconds || 0),
    min_uptime_seconds: Number(item.min_uptime_seconds || 0),
    had_restart: Number(item.had_restart || 0),
  }));
};

export const getSwitchUptimeAvailablePeriods = async (itemid: number): Promise<AvailablePeriod[]> => {
  const { data } = await api.get<AvailablePeriod[]>(`/switch-uptime-periods/${itemid}`);
  return data;
};

// ─── GLPI Interfaces ─────────────────────────────────────────────────────

export interface GlpiKpiSummary {
  month: string;
  ticketsCreated: number;
  ticketsClosed: number;
  resolutionRate: number;
  timeToOwn: number;
  timeToClose: number;
}

export interface GlpiTicketVolume {
  month: string;
  tickets: number;
}

export interface GlpiTimeTrends {
  timeToOwn: { month: string; value: number }[];
  timeToClose: { month: string; value: number }[];
}

// ─── GLPI API Functions ──────────────────────────────────────────────────

export const getGlpiKpiSummary = async (month?: string, type?: number): Promise<GlpiKpiSummary> => {
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (type !== undefined && type !== null) params.append('type', type.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await glpiApi.get<GlpiKpiSummary>(`/kpi-summary${query}`);
  return data;
};

export const getGlpiTicketVolume = async (type?: number): Promise<GlpiTicketVolume[]> => {
  const params = new URLSearchParams();
  if (type !== undefined && type !== null) params.append('type', type.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await glpiApi.get<GlpiTicketVolume[]>(`/ticket-volume${query}`);
  return data;
};

export const getGlpiTimeTrends = async (type?: number): Promise<GlpiTimeTrends> => {
  const params = new URLSearchParams();
  if (type !== undefined && type !== null) params.append('type', type.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await glpiApi.get<GlpiTimeTrends>(`/time-trends${query}`);
  return data;
};

// ─── Report Charts (30-day daily histories for all monitored items) ─────────

export interface ChartDayRaw {
  day: string;
  min: number;
  max: number;
  avg: number;
}

export interface AgentChartDay {
  day: string;
  avail_pct: number;
}

export interface ReportChartItem {
  itemid: number;
  label: string;
  host: string;
  type: 'service' | 'uptime' | 'agent' | 'sfp' | 'switch_uptime';
  service: string;
  data: ChartDayRaw[];
}

export interface ReportAgentItem {
  itemid: number;
  label: string;
  host: string;
  type: 'agent';
  service: string;
  data: AgentChartDay[];
}

export interface ZabbixReportCharts {
  services: ReportChartItem[];
  uptimes: ReportChartItem[];
  agents: ReportAgentItem[];
  sfpPorts: ReportChartItem[];
  switchUptimes: ReportChartItem[];
}

export const getZabbixReportCharts = async (): Promise<ZabbixReportCharts> => {
  const { data } = await api.get<ZabbixReportCharts>('/report-charts');
  return data;
};

// ─── Email / Report API ──────────────────────────────────────────────────

const reportApi = axios.create({ baseURL: '/report' });

export const sendReportByEmail = async (
  pdfBase64: string,
  filename: string,
  monthLabel: string,
): Promise<void> => {
  await reportApi.post('/send-email', { pdfBase64, filename, monthLabel });
};
