import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, CheckCircle2, XCircle, Clock, Shield, AlertTriangle, Activity, Zap } from 'lucide-react';
import {
  getAgentAvailabilityHistory,
  getAgentAvailablePeriods,
  type AgentStat,
  type AgentHistoryPoint,
  type AvailablePeriod,
} from '../services/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatLastOutage = (dateStr: string | null): string => {
  if (!dateStr) return 'None';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${hours}:${minutes}`;
};

const formatLastOutageFull = (dateStr: string | null): string => {
  if (!dateStr) return 'No outages in 30 days';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hours}:${minutes}`;
};

const getColorForAvailability = (pct: number) => {
  if (pct >= 99.9) return '#3DBE7A';
  if (pct >= 99.0) return '#F59E0B';
  return '#EF4444';
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

/* ─────────────────── Availability Ring ─────────────────── */

const AvailabilityRing: React.FC<{ percentage: number; color: string; size?: number }> = ({
  percentage,
  color,
  size = 64,
}) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#F1F5F9"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  );
};

/* ─────────────────── Expanded Panel ─────────────────── */

interface ExpandedAgentPanelProps {
  agent: AgentStat;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, AgentHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, AgentHistoryPoint[]>>>;
}

const ExpandedAgentPanel: React.FC<ExpandedAgentPanelProps> = ({
  agent,
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

  const itemid = agent.itemid;

  // Load available periods on mount
  useEffect(() => {
    if (!availablePeriodsCache[itemid]) {
      getAgentAvailablePeriods(itemid).then(periods => {
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
    
    const { key, from, to } = currentSelectionParams;
    if (customHistoryCache[key]) {
     
      return;
    }

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    getAgentAvailabilityHistory(itemid, from, to)
      .then(history => {
        if (isMounted) {
          setCustomHistoryCache(prev => ({ ...prev, [key]: history }));
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load agent history for panel", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, itemid, activePreset]);

  let currentHistory: AgentHistoryPoint[] = [];
  if (currentSelectionParams && customHistoryCache[currentSelectionParams.key]) {
    currentHistory = customHistoryCache[currentSelectionParams.key];
  }

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

  // Chart Configuration
  const chartData = currentHistory.map(pt => ({
    x: pt.day,
    y: Number(pt.availability_pct),
    outages: Number(pt.outages)
  }));

  const barColors = chartData.map(pt => {
    if (pt.y === 100) return '#3DBE7A';
    if (pt.y >= 99) return '#F59E0B';
    return '#EF4444';
  });

  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
      fontFamily: 'Inter, sans-serif',
    },
    colors: barColors,
    plotOptions: {
      bar: {
        borderRadius: 4,
        borderRadiusApplication: 'end',
        columnWidth: '48%',
        distributed: true,
      }
    },
    states: {
      hover: { filter: { type: 'darken' } },
      active: { filter: { type: 'darken' } },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: '#EEF2F7',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 8, right: 8, top: -4 },
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
        style: { colors: '#94A3B8', fontSize: '10.5px', fontWeight: 500 },
        rotate: 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: (val) => `${val}%`,
        style: { colors: '#94A3B8', fontSize: '15px' }
      }
    },
    tooltip: {
      custom: function({ seriesIndex, dataPointIndex, w }: any) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(data.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const statusColor = data.y === 100 ? '#3DBE7A' : data.y >= 99 ? '#F59E0B' : '#EF4444';
        return `
          <div style="padding:10px 13px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,0.14);border-radius:10px;border:1px solid #E2E8F0;font-family:Inter,sans-serif;min-width:148px">
            <div style="font-size:11px;font-weight:700;color:#0F172A;margin-bottom:7px">${dayStr}</div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:3px">
              <span style="font-size:11px;color:#94A3B8">Available</span>
              <span style="font-size:13px;font-weight:700;color:${statusColor}">${data.y}%</span>
            </div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px">
              <span style="font-size:11px;color:#94A3B8">Outages</span>
              <span style="font-size:12px;font-weight:600;color:#0F172A">${data.outages}</span>
            </div>
          </div>
        `;
      }
    }
  };

  const series = [{ name: 'Availability', data: chartData }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');

  const currentStatusLabel = String(agent.current_status) === '1' ? 'Available' : 'Unavailable';
  const currentStatusColor = String(agent.current_status) === '1' ? '#3DBE7A' : '#EF4444';

  const totalOutagesInPeriod = currentHistory.reduce((sum, pt) => sum + Number(pt.outages), 0);

  let interpretationText = '';
  let InterpretationIcon: React.ElementType = CheckCircle2;
  let interpretationColor = '#10B981';
  if (totalOutagesInPeriod === 0) {
    interpretationText = `Perfect availability. No outages detected in the selected period.`;
    InterpretationIcon = CheckCircle2;
    interpretationColor = '#10B981';
  } else if (totalOutagesInPeriod <= 3) {
    interpretationText = `${totalOutagesInPeriod} outage event${totalOutagesInPeriod > 1 ? 's' : ''} detected. Minor impact on overall availability.`;
    InterpretationIcon = Zap;
    interpretationColor = '#F59E0B';
  } else {
    interpretationText = `${totalOutagesInPeriod} outage events detected. Review agent health and network connectivity.`;
    InterpretationIcon = AlertTriangle;
    interpretationColor = '#EF4444';
  }

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-out"
      style={{ animation: 'slideDown 0.4s ease-out' }}
    >
      <div className="border-t border-[#E2E8F0]" />

      <div className="p-5 bg-gradient-to-b from-[#F8FAFC] to-white">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Current Status', value: currentStatusLabel, icon: Shield, color: currentStatusColor },
            { label: 'Total Checks', value: formatNumber(agent.total_checks), icon: Activity, color: '#2B5BA8' },
            { label: 'Outages (30d)', value: formatNumber(agent.unavailable_checks), icon: AlertTriangle, color: agent.unavailable_checks > 0 ? '#F59E0B' : '#3DBE7A' },
            { label: 'Last Outage', value: formatLastOutageFull(agent.last_unavailable), icon: Clock, color: !agent.last_unavailable ? '#3DBE7A' : '#F59E0B' },
          ].map((metric, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-[#E2E8F0]
                hover:shadow-sm transition-shadow duration-200"
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${metric.color}15` }}
              >
                <metric.icon className="w-3.5 h-3.5" style={{ color: metric.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-[#94A3B8] font-semibold">{metric.label}</p>
                <p className="text-[15px] font-bold text-[#0F172A] truncate">{metric.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {/* Chart Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 border-b border-[#F1F5F9] gap-3">
            <div>
              <h4 className="text-[15px] font-semibold text-[#0F172A]">
                Daily Availability — {periodLabel}
              </h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[15px] text-[#64748B]">
                  <span className="w-2 h-2 rounded-sm bg-[#3DBE7A]" /> 100%
                </span>
                <span className="flex items-center gap-1.5 text-[15px] text-[#64748B]">
                  <span className="w-2 h-2 rounded-sm bg-[#F59E0B]" /> Degraded
                </span>
                <span className="flex items-center gap-1.5 text-[15px] text-[#64748B]">
                  <span className="w-2 h-2 rounded-sm bg-[#EF4444]" /> Critical
                </span>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[#F1F5F9] rounded-lg p-0.5">
                {[7, 15, 30].map(days => (
                  <button
                    key={days}
                    onClick={() => handlePresetClick(days)}
                    className={`px-2.5 py-1 text-[15px] font-medium rounded-md transition-all duration-200 ${
                      activePreset === days
                        ? 'bg-[#3A9DBF] text-white shadow-sm'
                        : 'text-[#64748B] hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-[#E2E8F0]" />

              <select
                className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[15px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#3A9DBF] cursor-pointer"
                value={selectedYear || ''}
                onChange={handleYearChange}
              >
                <option value="" disabled>Year</option>
                {years.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <select
                className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[15px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#3A9DBF] cursor-pointer"
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

          {/* Chart Area */}
          <div className="h-[220px] w-full px-2">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#3A9DBF] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[15px] text-[#94A3B8]">Loading chart data...</span>
                </div>
              </div>
            ) : error ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <p className="text-[#94A3B8] text-[15px] mb-2">Unable to load chart data</p>
                <button 
                  onClick={() => setCustomHistoryCache(prev => { const next = {...prev}; delete next[currentSelectionParams!.key]; return next; })}
                  className="px-3 py-1.5 bg-[#F1F5F9] text-[#475569] text-[18px] font-medium rounded-md hover:bg-[#E2E8F0] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-[#94A3B8] text-[15px]">No data available for this period</p>
              </div>
            ) : (
              <Chart options={chartOptions} series={series} type="bar" width="100%" height="100%" />
            )}
          </div>
        </div>

        {/* Interpretation */}
        <div className="mt-3 flex items-start gap-2 p-3 bg-white border border-[#E2E8F0] rounded-lg">
          <InterpretationIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: interpretationColor }} />
          <p className="text-[18px] text-[#475569] leading-relaxed">{interpretationText}</p>
        </div>
      </div>
    </div>
  );
};


/* ─────────────────── Agent Card ─────────────────── */

interface AgentCardProps {
  agent: AgentStat;
  isExpanded: boolean;
  onToggle: () => void;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, AgentHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, AgentHistoryPoint[]>>>;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  isExpanded, 
  onToggle,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache
}) => {
  const pctNum = Number(agent.availability_pct);
  const color = getColorForAvailability(pctNum);
  const availableChecks = agent.total_checks - agent.unavailable_checks;

  const isAvailable = String(agent.current_status) === '1';

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ease-out
        ${isExpanded ? 'shadow-lg ring-1 ring-[#3A9DBF]/20' : 'shadow-sm hover:shadow-md border border-[#E2E8F0]'}`}
    >
      {/* Collapsed Header */}
      <div
        className="cursor-pointer select-none transition-colors duration-200 hover:bg-[#FAFCFF] p-5 flex flex-col gap-4"
        onClick={onToggle}
      >
        {/* Top Row: Agent Name & Status Badge + Chevron */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F1F5F9] text-[#64748B] flex-shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2.5">
              <h3 className="text-[18px] font-bold text-[#0F172A] truncate">{agent.host}</h3>
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isAvailable ? '#F0FDF4' : '#FEF2F2',
                  color: isAvailable ? '#15803d' : '#EF4444',
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${!isAvailable ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: isAvailable ? '#15803d' : '#EF4444' }}
                />
                {isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F5F9] transition-colors flex-shrink-0">
            <ChevronDown
              className={`w-4 h-4 text-[#64748B] transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Middle Row: Ring + Hero percentage */}
        <div className="flex items-center gap-4">
          {/* Availability Ring */}
          <div className="relative flex-shrink-0">
            <AvailabilityRing percentage={pctNum} color={color} size={56} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#64748B]">{Math.round(pctNum)}%</span>
            </div>
          </div>

          {/* Availability Hero percentage */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-0.5 mb-1.5">
              <span className="text-[24px] font-extrabold tabular-nums leading-none" style={{ color }}>
                {pctNum.toFixed(2)}
              </span>
              <span className="text-[15px] font-extrabold" style={{ color }}>%</span>
              <span className="text-[15px] text-[#94A3B8] ml-1.5 font-semibold">availability</span>
            </div>

            {/* Compact progress bar */}
            <div className="w-full h-[4px] bg-[#F1F5F9] rounded-full overflow-hidden max-w-[200px]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${pctNum}%`, backgroundColor: color }}
              />
            </div>

            {/* Calculation explanation */}
            <p className="text-[10px] text-label mt-1.5">
              = {formatNumber(availableChecks)} OK checks ÷ {formatNumber(agent.total_checks)} total × 100 · last 30 days
            </p>
          </div>
        </div>

        {/* Bottom Row: Mini Stat Pills (full card width grid) */}
        <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-[#F1F5F9]">
          {[
            { label: 'AVAIL CHECKS', value: formatNumber(availableChecks), icon: CheckCircle2, iconColor: '#3DBE7A' },
            { label: 'OUTAGES', value: formatNumber(agent.unavailable_checks), icon: XCircle, iconColor: '#EF4444' },
            { label: 'LAST OUTAGE', value: formatLastOutage(agent.last_unavailable), icon: Clock, iconColor: '#64748B' },
          ].map((pill, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-2 px-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]"
            >
              <div className="flex items-center gap-1 mb-1 max-w-full justify-center">
                <pill.icon className="w-3 h-3 flex-shrink-0" style={{ color: pill.iconColor }} />
                <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold truncate">{pill.label}</span>
              </div>
              <span className="text-[18px] font-extrabold text-[#0F172A] whitespace-nowrap truncate w-full text-center">{pill.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <ExpandedAgentPanel 
          agent={agent}
          availablePeriodsCache={availablePeriodsCache}
          customHistoryCache={customHistoryCache}
          setAvailablePeriodsCache={setAvailablePeriodsCache}
          setCustomHistoryCache={setCustomHistoryCache}
        />
      )}
    </div>
  );
};


/* ─────────────────── Section ─────────────────── */

interface AgentAvailabilitySectionProps {
  data: AgentStat[];
}

const AgentAvailabilitySection: React.FC<AgentAvailabilitySectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, AgentHistoryPoint[]>>({});

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 rounded-full bg-[#3A9DBF]" />
        <h3 className="text-[15px] font-semibold text-[#0F172A]">Agent Availability</h3>
        <span className="text-[15px] text-[#94A3B8] font-medium ml-1">
          {data.length} {data.length === 1 ? 'agent' : 'agents'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 transition-all duration-300">
        {data.map(agent => {
          const isExpanded = expandedItemId === agent.itemid;
          return (
            <div
              key={agent.itemid}
              className={`transition-all duration-300 ease-out ${
                isExpanded ? 'lg:col-span-2' : 'lg:col-span-1'
              }`}
            >
              <AgentCard 
                agent={agent} 
                isExpanded={isExpanded}
                onToggle={() => setExpandedItemId(prev => prev === agent.itemid ? null : agent.itemid)}
                availablePeriodsCache={availablePeriodsCache}
                customHistoryCache={customHistoryCache}
                setAvailablePeriodsCache={setAvailablePeriodsCache}
                setCustomHistoryCache={setCustomHistoryCache}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentAvailabilitySection;
