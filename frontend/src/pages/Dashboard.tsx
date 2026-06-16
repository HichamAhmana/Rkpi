import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Server, Monitor, Activity, WifiOff } from 'lucide-react';
import KPICard from '../components/KPICard';
// import EventsChart from '../components/charts/EventsChart';
import ProblemsByHostChart from '../components/charts/ProblemsByHostChart';
import HostAvailabilityChart from '../components/charts/HostAvailabilityChart';
import TriggerSeverityChart from '../components/charts/TriggerSeverityChart';
import CpuUsageChart from '../components/charts/CpuUsageChart';
import CpuDetailsTable from '../components/CpuDetailsTable';
import ServiceAvailabilityTable from '../components/ServiceAvailabilityTable';
import AgentAvailabilitySection from '../components/AgentAvailabilitySection';
import UptimeSection from '../components/UptimeSection';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import {
  getHostStats,
  getTriggerStats,
  // getEventsByDay,
  getProblemsByHost,
  getCpuStats,
  getCpuDetails,
  getServiceAvailability,
  getAgentAvailabilityStats,
  getUptimeStats,
} from '../services/api';
import type {
  HostStats,
  TriggerStats,
  // EventByDay,
  ProblemByHost,
  CpuStat,
  CpuDetail,
  ServerServices,
  AgentStat,
  UptimeStat,
} from '../services/api';

const POLL_INTERVAL = 60_000; // 60 seconds

const Dashboard: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hostStats, setHostStats] = useState<HostStats | null>(null);
  const [triggerStats, setTriggerStats] = useState<TriggerStats | null>(null);
  // const [eventsData, setEventsData] = useState<EventByDay[]>([]);
  const [problemsData, setProblemsData] = useState<ProblemByHost[]>([]);
  const [cpuData, setCpuData] = useState<CpuStat[]>([]);
  const [cpuDetailsData, setCpuDetailsData] = useState<CpuDetail[]>([]);
  const [serviceData, setServiceData] = useState<ServerServices[]>([]);
  const [agentData, setAgentData] = useState<AgentStat[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimeStat[]>([]);

  const isMountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnceRef.current) {
        setInitialLoading(true);
      }

      const [hosts, triggers, problems, cpus, cpuDetails, services, agents, uptimes] =
        await Promise.all([
          getHostStats(),
          getTriggerStats(),
          // getEventsByDay(),
          getProblemsByHost(),
          getCpuStats(),
          getCpuDetails(),
          getServiceAvailability(),
          getAgentAvailabilityStats(),
          getUptimeStats(),
        ]);

      if (isMountedRef.current) {
        setHostStats(hosts);
        setTriggerStats(triggers);
        // setEventsData(events);
        setProblemsData(problems);
        setCpuData(cpus);
        setCpuDetailsData(cpuDetails);
        setServiceData(services);
        setAgentData(agents);
        setUptimeData(uptimes);
        setError(null);

        if (!hasLoadedOnceRef.current) {
          hasLoadedOnceRef.current = true;
          setInitialLoading(false);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching dashboard data:', err);
        if (!hasLoadedOnceRef.current) {
          setError('Failed to load dashboard data. Please try again later.');
          setInitialLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  // ─── Loading state: skeleton loaders ──────────────────────────────
  if (initialLoading) {
    return <DashboardSkeleton />;
  }

  // ─── Error state ──────────────────────────────────────────────────
  if (error || !hostStats || !triggerStats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div
          className="bg-white rounded-xl border border-[#E2E8F0] p-10 flex flex-col items-center max-w-md text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <WifiOff className="w-7 h-7 text-[#EF4444]" />
          </div>
          <h2 className="text-[18px] font-semibold text-[#0F172A] mb-2">Unable to Load Data</h2>
          <p className="text-[14px] text-[#94A3B8] mb-6">
            {error || 'Incomplete data received from the server.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-white transition-colors duration-150"
            style={{ backgroundColor: '#2B5BA8' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563B0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2B5BA8')}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard content ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title="Total Hosts"
          value={hostStats.total}
          icon={Server}
          accentColor="#2B5BA8"
        />
        <KPICard
          title="Online"
          value={hostStats.online}
          icon={Monitor}
          accentColor="#3DBE7A"
          trend={{ value: 2.4, isUp: true }}
        />
        <KPICard
          title="Offline"
          value={hostStats.offline}
          icon={Monitor}
          accentColor="#EF4444"
        />
        <KPICard
          title="Problems"
          value={triggerStats.problem}
          icon={Activity}
          accentColor="#F59E0B"
          trend={{ value: 5.1, isUp: false }}
        />
      </div>

      {/* Server Uptime */}
      <UptimeSection data={uptimeData} />

      {/* Agent Availability */}
      <AgentAvailabilitySection data={agentData} />

      {/* Service Availability */}
      <ServiceAvailabilityTable data={serviceData} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 1: Host Availability (1/3) & Trigger Severity (2/3) */}
        <div>
          <HostAvailabilityChart data={hostStats} />
        </div>
        <div className="lg:col-span-2">
          <TriggerSeverityChart data={triggerStats} />
        </div>
        
        {/* Row 2: Problems by Host (1/3) & CPU Usage (2/3) */}
        <div>
          <ProblemsByHostChart data={problemsData} />
        </div>
        <div className="lg:col-span-2">
          <CpuUsageChart data={cpuData} />
        </div>
      </div>

      {/* CPU Details Table */}
      <CpuDetailsTable data={cpuDetailsData} />
    </div>
  );
};

export default Dashboard;
