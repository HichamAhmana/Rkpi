import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { 
  ChevronDown, 
  ChevronUp, 
  Server,
  Clock,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';
import {
  getServiceHistory,
  getServiceAvailablePeriods,
  type ServerServices,
  type HistoryPoint,
  type AvailablePeriod,
  type ServiceItem,
} from '../services/api';
import { BRAND, STATUS, TEXT, SURFACE } from '../styles/colors';

interface ServiceAvailabilityTableProps {
  data: ServerServices[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  running: { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669', dot: '#10B981', label: 'Running' },
  anomaly: { bg: 'rgba(245, 158, 11, 0.08)', text: '#D97706', dot: '#F59E0B', label: 'Anomaly' },
  stopped: { bg: 'rgba(239, 68, 68, 0.08)', text: '#DC2626', dot: '#EF4444', label: 'Stopped' },
};

const formatLastIncident = (dateStr: string | null): string => {
  if (!dateStr) return 'None';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
};

const getStatusForService = (currentState: string, incidentDays: number) => {
  if (String(currentState) !== '0') return 'stopped';
  if (incidentDays > 0) return 'anomaly';
  return 'running';
};

const parseServiceName = (fullName: string) => {
  const match = fullName.match(/State of service "([^"]+)" \(([^)]+)\)/);
  if (match) {
    return { name: match[1], description: match[2] };
  }
  const simpleMatch = fullName.match(/service "([^"]+)"/);
  if (simpleMatch) {
    return { name: simpleMatch[1], description: fullName };
  }
  return { name: fullName, description: '' };
};

const StatusBadge: React.FC<{ currentState: string; incidentDays: number }> = ({ currentState, incidentDays }) => {
  const status = getStatusForService(currentState, incidentDays);
  const config = statusConfig[status] || statusConfig.stopped;
  const isRunning = status === 'running';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[18px] font-medium transition-all duration-200"
      style={{ 
        backgroundColor: config.bg, 
        color: config.text,
        boxShadow: isRunning ? '0 0 8px rgba(16, 185, 129, 0.1)' : 'none'
      }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full" 
        style={{ 
          backgroundColor: config.dot,
          animation: isRunning ? 'status-pulse 2s infinite' : 'none'
        }} 
      />
      {config.label}
    </span>
  );
};

// --- Sparkline Component ---
const ServiceSparkline: React.FC<{ history: HistoryPoint[]; isRunning: boolean }> = ({ history, isRunning }) => {
  const color = isRunning ? BRAND.green : STATUS.danger;

  const chartOptions: ApexOptions = {
    chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
    colors: [color],
    stroke: { curve: 'smooth', width: 1.5 },
    fill: { type: 'solid', opacity: 0.15 },
    xaxis: { 
      type: 'datetime',
    },
    tooltip: { enabled: false },
  };

  const series = [
    {
      name: 'State',
      data: history.map((pt) => ({
        x: new Date(pt.time).getTime(),
        y: pt.value > 0 ? 1 : 0,
      })),
    },
  ];

  return <Chart options={chartOptions} series={series} type="area" width={140} height={36} />;
};

// --- Expanded Panel Component ---
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface ExpandedServicePanelProps {
  service: ServiceItem;
  defaultHistory: HistoryPoint[];
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, HistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, HistoryPoint[]>>>;
}

const ExpandedServicePanel: React.FC<ExpandedServicePanelProps> = ({
  service,
  defaultHistory,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache,
}) => {
  const [activePreset, setActivePreset] = useState<number | null>(30);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const itemid = service.itemid;

  useEffect(() => {
    if (!availablePeriodsCache[itemid]) {
      getServiceAvailablePeriods(itemid).then(periods => {
        setAvailablePeriodsCache(prev => ({ ...prev, [itemid]: periods }));
      }).catch(err => console.error("Failed to load periods", err));
    }
  }, [itemid, availablePeriodsCache, setAvailablePeriodsCache]);

  const periods = availablePeriodsCache[itemid] || [];
  const years = Array.from(new Set(periods.map(p => p.year))).sort((a, b) => b - a);
  const monthsForSelectedYear = periods.filter(p => p.year === selectedYear).map(p => p.month).sort((a, b) => b - a);

  const currentSelectionParams = useMemo(() => {
    if (activePreset !== null) {
      if (activePreset === 30) {
        return { key: `${itemid}-preset-30`, from: undefined, to: undefined };
      }
      const to = Math.floor(Date.now() / 1000);
      const from = to - activePreset * 24 * 60 * 60;
      return { key: `${itemid}-preset-${activePreset}`, from, to: undefined };
    } else if (selectedYear && selectedMonth) {
      const from = Math.floor(new Date(selectedYear, selectedMonth - 1, 1).getTime() / 1000);
      const to = Math.floor(new Date(selectedYear, selectedMonth, 1).getTime() / 1000) - 1;
      return { key: `${itemid}-custom-${selectedYear}-${selectedMonth}`, from, to };
    }
    return null;
  }, [itemid, activePreset, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!currentSelectionParams) return;
    
    if (activePreset === 30 && defaultHistory.length > 0) {
      return; 
    }

    const { key, from, to } = currentSelectionParams;
    if (customHistoryCache[key]) {
      return;
    }

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);

    getServiceHistory(itemid, from, to)
      .then(history => {
        if (isMounted) {
          setCustomHistoryCache(prev => ({ ...prev, [key]: history }));
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load history for panel", err);
        setError(true);
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, defaultHistory, itemid, activePreset]);

  let currentHistory: HistoryPoint[] = [];
  if (activePreset === 30) {
    currentHistory = defaultHistory;
  } else if (currentSelectionParams && customHistoryCache[currentSelectionParams.key]) {
    currentHistory = customHistoryCache[currentSelectionParams.key];
  }

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    currentHistory.forEach(p => {
      const dayStr = p.time.split('T')[0];
      if (grouped[dayStr] === undefined) {
        grouped[dayStr] = p.value;
      } else {
        grouped[dayStr] = Math.max(grouped[dayStr], p.value);
      }
    });
    return Object.keys(grouped).sort().map(day => ({
      time: day,
      value: grouped[day],
    }));
  }, [currentHistory]);

  const handlePresetClick = (days: number) => {
    setActivePreset(days);
    setSelectedYear(null);
    setSelectedMonth(null);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
    const validMonths = periods.filter(p => p.year === year).map(p => p.month);
    if (selectedMonth === null || !validMonths.includes(selectedMonth)) {
      setSelectedMonth(validMonths.length > 0 ? Math.max(...validMonths) : null);
    }
    setActivePreset(null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value));
    setActivePreset(null);
  };

  const status = getStatusForService(service.current_state, service.incident_days);
  const badgeConfig = statusConfig[status] || statusConfig.stopped;

  const annotations = chartData.filter(d => d.value > 0).map(d => ({
    x: new Date(d.time).getTime(),
    marker: {
      size: 5,
      fillColor: STATUS.danger,
      strokeColor: STATUS.danger,
      radius: 2,
    },
    label: {
      borderColor: STATUS.danger,
      style: { color: '#fff', background: STATUS.danger },
      text: 'Issue',
    }
  }));

  const chartOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: [BRAND.green],
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0.02,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: SURFACE.borderLight,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'datetime',
      min: currentSelectionParams?.from ? currentSelectionParams.from * 1000 : undefined,
      max: currentSelectionParams?.to ? currentSelectionParams.to * 1000 : undefined,
      labels: {
        formatter: function (value) {
          const d = new Date(value);
          return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0,3)}`;
        },
        style: { colors: TEXT.label, fontSize: '15px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      show: true,
      min: 0,
      max: 1,
      tickAmount: 1,
      labels: {
        formatter: (val) => val === 0 ? 'Running' : 'Problem',
        style: { colors: TEXT.label, fontSize: '15px' }
      }
    },
    tooltip: {
      x: { format: 'dd MMM yyyy' },
      y: {
        formatter: (val) => val === 0 ? 'Running' : 'Issue',
        title: { formatter: () => '' }
      }
    },
    annotations: { points: annotations }
  };

  const series = [{
    name: 'State',
    data: chartData.map(pt => ({
      x: new Date(pt.time).getTime(),
      y: pt.value > 0 ? 1 : 0
    }))
  }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');
  const parsedName = parseServiceName(service.service_name);

  let interpretationText = '';
  let InterpretationIcon: React.ElementType = CheckCircle2;
  let interpretationColor = '#10B981';
  if (status === 'running') {
    interpretationText = 'Service running continuously with no incidents detected in the last 30 days.';
    InterpretationIcon = CheckCircle2;
    interpretationColor = '#10B981';
  } else if (status === 'anomaly') {
    interpretationText = `${service.incident_days} incident day(s) detected in the last 30 days${service.last_incident ? `, most recently on ${formatLastIncident(service.last_incident)}` : ''}. Service is currently running.`;
    InterpretationIcon = Zap;
    interpretationColor = '#F59E0B';
  } else {
    interpretationText = `Service is currently stopped${service.last_incident ? ` — last incident on ${formatLastIncident(service.last_incident)}` : ''}. Immediate attention recommended.`;
    InterpretationIcon = AlertTriangle;
    interpretationColor = '#EF4444';
  }

  return (
    <div className="bg-[#FAFBFD] border-t border-[var(--color-border)] p-6 flex flex-col lg:flex-row gap-8 transition-all duration-300">
      <div className="w-full lg:w-[28%] flex flex-col justify-between">
        <div>
          <h4 className="text-[15px] font-bold text-slate-800 mb-1">{parsedName.name}</h4>
          {parsedName.description && (
            <p className="text-[18px] text-slate-400 mb-4">{parsedName.description}</p>
          )}
          
          <div className="grid grid-cols-2 lg:flex lg:flex-col gap-4">
            <div className="flex flex-col border-b border-slate-100 pb-2.5">
              <span className="text-slate-400 text-[15px] font-bold uppercase tracking-wider mb-1">Status</span>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[18px] font-semibold"
                  style={{ backgroundColor: badgeConfig.bg, color: badgeConfig.text }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badgeConfig.dot }} />
                  {badgeConfig.label}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col border-b border-slate-100 pb-2.5">
              <span className="text-slate-400 text-[15px] font-bold uppercase tracking-wider mb-1">Incidents (30d)</span>
              <span className={`text-[18px] font-bold ${service.incident_days === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {service.incident_days}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                = days with ≥ 1 non-running state in the last 30 days
              </span>
            </div>

            <div className="flex flex-col border-b border-slate-100 pb-2.5">
              <span className="text-slate-400 text-[15px] font-bold uppercase tracking-wider mb-1">Last Incident</span>
              <span className={`text-[15px] font-bold ${!service.last_incident ? 'text-emerald-500' : 'text-slate-700'}`}>
                {formatLastIncident(service.last_incident)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <span className="text-slate-400 text-[15px] font-bold uppercase tracking-wider block mb-0.5">Monitoring Scope</span>
          <span className="text-[15px] font-semibold text-slate-700">
            {periodLabel}
          </span>
        </div>
      </div>

      <div className="w-full lg:w-[72%] flex flex-col bg-white border border-slate-100 p-5 rounded-xl shadow-xs">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-5 gap-4">
          <div>
            <h4 className="text-[13.5px] font-bold text-slate-805 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-400" />
              Service Status Timeline
            </h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              0 = Running (Operational) · Above 0 = Problem/Outage
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-105">
              {[7, 15, 30].map(days => (
                <button
                  key={days}
                  onClick={() => handlePresetClick(days)}
                  className={`px-3 py-1 text-[15px] font-bold rounded-md transition-all duration-205 ${
                    activePreset === days
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>

            <div className="w-[1px] h-6 bg-slate-200" />

            <div className="flex items-center gap-2">
              <select
                className="bg-white border border-slate-200 text-slate-700 text-[11.5px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer transition-all"
                value={selectedYear || ''}
                onChange={handleYearChange}
              >
                <option value="" disabled>Year</option>
                {years.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <select
                className="bg-white border border-slate-200 text-slate-700 text-[11.5px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer transition-all disabled:opacity-50"
                value={selectedMonth || ''}
                onChange={handleMonthChange}
                disabled={!selectedYear}
              >
                <option value="" disabled>Month</option>
                {monthsForSelectedYear.map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-[210px] w-full relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
               <div className="skeleton w-full h-[190px] rounded-lg animate-pulse bg-slate-100" />
            </div>
          ) : error ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-lg p-5">
              <p className="text-slate-400 text-[15px] mb-2 font-medium">Unable to load chart data</p>
              <button 
                onClick={() => setCustomHistoryCache(prev => { const next = {...prev}; delete next[currentSelectionParams!.key]; return next; })}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[18px] font-bold rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-100 rounded-lg">
              <p className="text-slate-500 text-[12.5px] font-medium">No details available for this selection</p>
            </div>
          ) : (
            <Chart options={chartOptions} series={series} type="area" width="100%" height="100%" />
          )}
        </div>

        {/* Interpretation */}
        <div className="mt-4 flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <InterpretationIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: interpretationColor }} />
          <p className="text-[18px] text-slate-500 leading-relaxed">{interpretationText}</p>
        </div>
      </div>
    </div>
  );
};


// --- Collapsible Server Card Component ---
interface ServerSectionProps {
  server: ServerServices;
  isExpanded: boolean;
  onToggle: () => void;
  historyMap: Record<number, HistoryPoint[]>;
  loadingMap: Record<number, boolean>;
  expandedRowItemId: number | null;
  onToggleRow: (itemid: number) => void;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, HistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, HistoryPoint[]>>>;
}

const ServerSection: React.FC<ServerSectionProps> = ({
  server,
  isExpanded,
  onToggle,
  historyMap,
  loadingMap,
  expandedRowItemId,
  onToggleRow,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache
}) => {
  const stats = useMemo(() => {
    let running = 0;
    let anomaly = 0;
    let stopped = 0;
    
    server.services.forEach(svc => {
      const status = getStatusForService(svc.current_state, svc.incident_days);
      if (status === 'running') running++;
      else if (status === 'anomaly') anomaly++;
      else if (status === 'stopped') stopped++;
    });

    let overallStatus: 'running' | 'anomaly' | 'stopped' = 'running';
    if (stopped > 0) overallStatus = 'stopped';
    else if (anomaly > 0) overallStatus = 'anomaly';

    return { running, anomaly, stopped, total: server.services.length, overallStatus };
  }, [server.services]);

  const borderLeftColor = {
    running: 'border-l-[4px] border-l-emerald-500',
    anomaly: 'border-l-[4px] border-l-amber-500',
    stopped: 'border-l-[4px] border-l-red-500',
  }[stats.overallStatus];

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${borderLeftColor}`}>
      {/* Server Header Card */}
      <div 
        onClick={onToggle}
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-lg flex items-center justify-center transition-colors duration-300 ${
            stats.overallStatus === 'stopped' 
              ? 'bg-red-50 text-red-500' 
              : stats.overallStatus === 'anomaly' 
                ? 'bg-amber-50 text-amber-500' 
                : 'bg-emerald-50 text-emerald-500'
          }`}>
            <Server className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-slate-800">
                {server.server_name}
              </span>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  stats.overallStatus === 'stopped' 
                    ? 'bg-red-400' 
                    : stats.overallStatus === 'anomaly' 
                      ? 'bg-amber-400' 
                      : 'bg-emerald-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  stats.overallStatus === 'stopped' 
                    ? 'bg-red-500' 
                    : stats.overallStatus === 'anomaly' 
                      ? 'bg-amber-500' 
                      : 'bg-emerald-500'
                }`} />
              </span>
            </div>
            <span className="text-[11.5px] text-slate-400 font-semibold mt-0.5">
              {stats.total} {stats.total === 1 ? 'service' : 'services'} monitored
            </span>
          </div>
        </div>

        {/* Center Stats Badges (large screen) */}
        <div className="hidden sm:flex items-center gap-3">
          {stats.running > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[15px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.running} Active
            </span>
          )}
          {stats.anomaly > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[15px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              {stats.anomaly} Anomaly
            </span>
          )}
          {stats.stopped > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[15px] font-bold bg-red-50 text-red-700 border border-red-100">
              <XCircle className="w-3.5 h-3.5" />
              {stats.stopped} Critical
            </span>
          )}
        </div>

        {/* Right Toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile indicator counts */}
          <div className="sm:hidden flex gap-1.5 items-center">
            {stats.stopped > 0 && <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">{stats.stopped}</span>}
            {stats.anomaly > 0 && <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-amber-500 rounded-full">{stats.anomaly}</span>}
          </div>
          
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-white">
          <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150">
                  <th className="pl-6 pr-4 py-3 text-[15px] font-bold text-slate-500 uppercase tracking-wider w-[36%]">Service Name</th>
                  <th className="px-4 py-3 text-[15px] font-bold text-slate-500 uppercase tracking-wider w-[14%]">Current Status</th>
                  <th className="px-4 py-3 text-[15px] font-bold text-slate-500 uppercase tracking-wider w-[14%]">Incidents (30D)</th>
                  <th className="px-4 py-3 text-[15px] font-bold text-slate-500 uppercase tracking-wider w-[18%]">Last Incident</th>
                  <th className="px-4 py-3 text-[15px] font-bold text-slate-500 uppercase tracking-wider w-[14%]">30-Day State Map</th>
                  <th className="pr-6 pl-2 py-3 w-[4%]"></th>
                </tr>
              </thead>
              <tbody>
                {server.services.map((svc) => {
                  const isRowExpanded = expandedRowItemId === svc.itemid;
                  const parsedName = parseServiceName(svc.service_name);
                  
                  return (
                    <React.Fragment key={`${server.server_name}-${svc.itemid}`}>
                      {/* Service Row */}
                      <tr
                        onClick={() => {
                          onToggleRow(svc.itemid);
                        }}
                        className={`border-b border-slate-100 transition-all duration-150 cursor-pointer group ${
                          isRowExpanded ? 'bg-slate-50/40' : 'hover:bg-slate-50/20'
                        }`}
                      >
                        {/* Service Label Column */}
                        <td className="pl-6 pr-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100 transition-colors">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13.5px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">
                                {parsedName.name}
                              </span>
                              {parsedName.description && (
                                <span className="text-[11.5px] text-slate-400 truncate mt-0.5">
                                  {parsedName.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-3.5">
                          <StatusBadge currentState={svc.current_state} incidentDays={svc.incident_days} />
                        </td>

                        {/* Incidents 30d Column */}
                        <td className="px-4 py-3.5">
                          {svc.incident_days === 0 ? (
                            <span className="text-[13.5px] font-semibold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">0</span>
                          ) : (
                            <span className="text-[13.5px] font-semibold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                              {svc.incident_days}
                            </span>
                          )}
                        </td>

                        {/* Last Incident Column */}
                        <td className="px-4 py-3.5 text-[18px] text-slate-500 font-medium font-sans">
                          {svc.last_incident ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-350" />
                              <span>{formatLastIncident(svc.last_incident)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">None</span>
                          )}
                        </td>

                        {/* Sparkline Column */}
                        <td className="px-4 py-3.5">
                          {loadingMap[svc.itemid] ? (
                            <div className="skeleton w-[140px] h-[36px] bg-slate-100 animate-pulse" />
                          ) : (
                            <div className="w-[140px] h-[36px] flex items-center overflow-hidden relative">
                              <ServiceSparkline
                                history={historyMap[svc.itemid] || []}
                                isRunning={String(svc.current_state) === '0'}
                              />
                            </div>
                          )}
                        </td>

                        {/* Row Toggle Trigger Button Column */}
                        <td className="pr-6 pl-2 py-3.5 text-right">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleRow(svc.itemid);
                              }}
                              className={`p-1.5 rounded-lg border transition-all duration-200 ${
                                isRowExpanded 
                                  ? 'bg-slate-800 border-slate-700 text-white' 
                                  : 'bg-slate-50 border-slate-150 text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-200'
                              }`}
                            >
                              {isRowExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Content */}
                      {isRowExpanded && (
                        <tr className="bg-slate-50/20">
                          <td colSpan={6} className="p-0 border-b border-slate-200">
                             <ExpandedServicePanel 
                               service={svc} 
                               defaultHistory={historyMap[svc.itemid] || []}
                               availablePeriodsCache={availablePeriodsCache}
                               customHistoryCache={customHistoryCache}
                               setAvailablePeriodsCache={setAvailablePeriodsCache}
                               setCustomHistoryCache={setCustomHistoryCache}
                             />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


// --- Main Section Component ---
const ServiceAvailabilityTable: React.FC<ServiceAvailabilityTableProps> = ({ data }) => {
  const [historyMap, setHistoryMap] = useState<Record<number, HistoryPoint[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [expandedRowItemId, setExpandedRowItemId] = useState<number | null>(null);

  // Accordion state for expanded servers (default expand first server)
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>(() => {
    if (data && data.length > 0) {
      return { [data[0].server_name]: true };
    }
    return {};
  });

  // Caches for the expanded panel
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, HistoryPoint[]>>({});


  useEffect(() => {
    const fetchHistories = async () => {
      const itemIds: number[] = [];
      data.forEach((server) => {
        server.services.forEach((svc) => {
          if (svc.itemid) itemIds.push(svc.itemid);
        });
      });

      if (itemIds.length === 0) return;

      setLoadingMap((prev) => {
        const next = { ...prev };
        itemIds.forEach((id) => {
          if (historyMap[id] === undefined) next[id] = true;
        });
        return next;
      });

      try {
        const fetchPromises = itemIds.map(async (id) => {
          try {
            const history = await getServiceHistory(id);
            return { id, history, error: false };
          } catch (e) {
            console.error(`Failed to fetch history for item ${id}`, e);
            return { id, history: [], error: true };
          }
        });

        const results = await Promise.all(fetchPromises);

        setHistoryMap((prev) => {
          const next = { ...prev };
          results.forEach(({ id, history }) => { next[id] = history; });
          return next;
        });

        setLoadingMap((prev) => {
          const next = { ...prev };
          results.forEach(({ id }) => { next[id] = false; });
          return next;
        });
      } catch (err) {
        console.error('Error in parallel history fetch:', err);
      }
    };

    fetchHistories();
  }, [data]);

  const toggleServer = (serverName: string) => {
    setExpandedServers(prev => ({
      ...prev,
      [serverName]: !prev[serverName]
    }));
  };

  const toggleRow = (itemid: number) => {
    setExpandedRowItemId(prev => prev === itemid ? null : itemid);
  };

  const totalServices = useMemo(() => {
    if (!data) return 0;
    return data.reduce((acc, curr) => acc + curr.services.length, 0);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
          <Activity className="w-6 h-6" />
        </div>
        <p className="text-slate-800 text-[18px] font-bold mb-1">No service availability data</p>
        <p className="text-slate-400 text-[18px]">Services will appear here when telemetry is received</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-indigo-500" style={{ backgroundColor: BRAND.darkBlue }} />
          <h3 className="text-[15px] font-bold text-slate-800">Service Availability</h3>
          <span className="text-[15px] text-slate-400 font-bold ml-1.5 bg-slate-100 px-2 py-0.5 rounded-full">
            {totalServices} Monitored
          </span>
        </div>
      </div>

      {/* List of Collapsible Servers */}
      <div className="flex flex-col gap-4">
        {data.map((server) => (
          <ServerSection
            key={server.server_name}
            server={server}
            isExpanded={!!expandedServers[server.server_name]}
            onToggle={() => toggleServer(server.server_name)}
            historyMap={historyMap}
            loadingMap={loadingMap}
            expandedRowItemId={expandedRowItemId}
            onToggleRow={toggleRow}
            availablePeriodsCache={availablePeriodsCache}
            customHistoryCache={customHistoryCache}
            setAvailablePeriodsCache={setAvailablePeriodsCache}
            setCustomHistoryCache={setCustomHistoryCache}
          />
        ))}
      </div>
    </div>
  );
};

export default ServiceAvailabilityTable;
