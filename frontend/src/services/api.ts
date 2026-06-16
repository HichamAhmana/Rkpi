import axios from 'axios';

const api = axios.create({
  baseURL: '/zabbix',
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

export interface CpuStat {
  host_name: string;
  cpu_utilization: string | number;
}

export interface CpuDetail {
  host_name: string;
  cpu_utilization: number | string | null;
  cpu_load: number | string | null;
  cpu_temperature: number | string | null;
  cpu_cores: number | string | null;
}

// ─── New Interfaces ────────────────────────────────────────────────

export interface ServiceItem {
  service_name: string;
  itemid: number;
  current_state: string;
  incident_days: number;
  last_incident: string | null;
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

export const getCpuStats = async (): Promise<CpuStat[]> => {
  const { data } = await api.get<CpuStat[]>('/cpu-stats');
  return data;
};

export const getCpuDetails = async (): Promise<CpuDetail[]> => {
  const { data } = await api.get<CpuDetail[]>('/cpu-details');
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
