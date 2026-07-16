import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, Clock, RotateCcw, Zap, Calendar, Server, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getUptimeHistory,
  getUptimeAvailablePeriods,
  type UptimeStat,
  type UptimeHistoryPoint,
  type AvailablePeriod,
} from '../services/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatLastRestart = (dateStr: string | null): string => {
  if (!dateStr) return 'None';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} · ${hours}:${minutes}`;
};

const formatLastRestartFull = (dateStr: string | null): string => {
  if (!dateStr) return 'No restart in 30 days';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hours}:${minutes}`;
};

const formatUptimeFull = (seconds: number): string => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const formatUptimeHero = (seconds: number): { days: number; hours: number; minutes: number } => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return { days: d, hours: h, minutes: m };
};

const formatUptimeShort = (seconds: number): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '---';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

const formatPercent = (pct: number): string =>
  Number.isInteger(pct) ? `${pct}` : pct.toFixed(1);

/* ─────────────────────── Animated Ring ─────────────────────── */
const UptimeRing: React.FC<{ percentage: number; color: string; size?: number }> = ({
  percentage,
  color,
  size = 72,
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

interface ExpandedUptimePanelProps {
  stat: UptimeStat;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, UptimeHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, UptimeHistoryPoint[]>>>;
}

const ExpandedUptimePanel: React.FC<ExpandedUptimePanelProps> = ({
  stat,
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

  const itemid = stat.itemid;

  // Load available periods on mount
  useEffect(() => {
    if (!availablePeriodsCache[itemid]) {
      getUptimeAvailablePeriods(itemid).then(periods => {
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
      setError(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    getUptimeHistory(itemid, from, to)
      .then(history => {
        if (isMounted) {
          setCustomHistoryCache(prev => ({ ...prev, [key]: history }));
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load uptime history for panel", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, itemid, activePreset]);

  let currentHistory: UptimeHistoryPoint[] = [];
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
    y: Number((Number(pt.max_uptime_seconds) / 86400).toFixed(2)),
    had_restart: Number(pt.had_restart),
    max_uptime_seconds: Number(pt.max_uptime_seconds)
  }));

  const barColors = chartData.map(pt => {
    return pt.had_restart === 1 ? '#EF4444' : '#2B5BA8';
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
      labels: {
        formatter: (val) => `${val.toFixed(0)}d`,
        style: { colors: '#94A3B8', fontSize: '15px' }
      }
    },
    annotations: {
      yaxis: [
        {
          y: 1,
          borderColor: '#CBD5E1',
          strokeDashArray: 4,
          label: {
            borderColor: 'transparent',
            style: {
              color: '#94A3B8',
              background: '#F8FAFC',
              fontSize: '10px',
              fontWeight: 600,
              padding: { left: 5, right: 5, top: 2, bottom: 2 },
            },
            text: '1 day'
          }
        }
      ]
    },
    tooltip: {
      custom: function({ seriesIndex, dataPointIndex, w }: any) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(data.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const statusColor = data.had_restart === 1 ? '#EF4444' : '#2B5BA8';
        const statusText = data.had_restart === 1 ? 'Restarted' : 'Stable';
        return `
          <div style="padding:10px 13px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,0.14);border-radius:10px;border:1px solid #E2E8F0;font-family:Inter,sans-serif;min-width:148px">
            <div style="font-size:11px;font-weight:700;color:#0F172A;margin-bottom:7px">${dayStr}</div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px">
              <span style="font-size:11px;color:#94A3B8">Max uptime</span>
              <span style="font-size:13px;font-weight:700;color:#0F172A">${formatUptimeShort(data.max_uptime_seconds)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:6px">
              <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};flex-shrink:0"></span>
              <span style="font-size:11px;font-weight:600;color:${statusColor}">${statusText}</span>
            </div>
          </div>
        `;
      }
    }
  };

  const series = [{ name: 'Uptime', data: chartData }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');
  const bootDate = new Date(Date.now() - stat.current_uptime_seconds * 1000);
  const bootDateStr = `${bootDate.getDate()} ${MONTH_NAMES[bootDate.getMonth()].substring(0,3)} ${bootDate.getFullYear()} at ${String(bootDate.getHours()).padStart(2, '0')}:${String(bootDate.getMinutes()).padStart(2, '0')}`;

  const currentPeriodRestarts = currentHistory.filter(pt => pt.had_restart === 1).length;

  let interpretationText = '';
  let InterpretationIcon: React.ElementType = CheckCircle2;
  let interpretationColor = '#10B981';
  if (currentPeriodRestarts === 0) {
    interpretationText = `No restarts detected. Server running continuously for ${formatUptimeFull(stat.current_uptime_seconds)}.`;
    InterpretationIcon = CheckCircle2;
    interpretationColor = '#10B981';
  } else if (currentPeriodRestarts === 1) {
    interpretationText = `1 restart detected on ${formatLastRestart(stat.last_restart_time)}. Uptime dropped briefly and recovered.`;
    InterpretationIcon = Zap;
    interpretationColor = '#F59E0B';
  } else {
    interpretationText = `${currentPeriodRestarts} restarts detected. Review maintenance logs for planned/unplanned reboots.`;
    InterpretationIcon = AlertTriangle;
    interpretationColor = '#EF4444';
  }

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-out"
      style={{
        animation: 'slideDown 0.4s ease-out',
      }}
    >
      <div className="border-t border-[#E2E8F0]" />
      
      <div className="p-5 bg-gradient-to-b from-[#F8FAFC] to-white">
        {/* Stats Row — 4 mini metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Current Uptime', value: formatUptimeShort(stat.current_uptime_seconds), icon: Clock, color: '#2B5BA8' },
            { label: 'Boot Time', value: bootDateStr, icon: Calendar, color: '#3A9DBF' },
            { label: 'Restarts (30d)', value: formatNumber(stat.restart_count), icon: RotateCcw, color: stat.restart_count > 0 ? '#EF4444' : '#3DBE7A' },
            { label: 'Last Restart', value: formatLastRestartFull(stat.last_restart_time), icon: Zap, color: !stat.last_restart_time ? '#3DBE7A' : '#F59E0B' },
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
                <p className="text-[12px] uppercase tracking-wide text-[#94A3B8] font-semibold">{metric.label}</p>
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
                Uptime History — {periodLabel}
              </h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[15px] text-[#64748B]">
                  <span className="w-2 h-2 rounded-sm bg-[#2B5BA8]" /> Stable
                </span>
                <span className="flex items-center gap-1.5 text-[15px] text-[#64748B]">
                  <span className="w-2 h-2 rounded-sm bg-[#EF4444]" /> Restart
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
                        ? 'bg-[#2B5BA8] text-white shadow-sm'
                        : 'text-[#64748B] hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-[#E2E8F0]" />

              <select
                className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[15px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2B5BA8] cursor-pointer"
                value={selectedYear || ''}
                onChange={handleYearChange}
              >
                <option value="" disabled>Year</option>
                {years.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <select
                className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[15px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2B5BA8] cursor-pointer"
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
                  <div className="w-6 h-6 border-2 border-[#2B5BA8] border-t-transparent rounded-full animate-spin" />
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


/* ─────────────────── Uptime Card ─────────────────── */

interface UptimeCardProps {
  stat: UptimeStat;
  isExpanded: boolean;
  onToggle: () => void;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, UptimeHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, UptimeHistoryPoint[]>>>;
}

const UptimeCard: React.FC<UptimeCardProps> = ({ 
  stat, 
  isExpanded, 
  onToggle,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache
}) => {
  const bootDate = new Date(Date.now() - stat.current_uptime_seconds * 1000);
  const bootDateStr = `Since ${bootDate.getDate()} ${MONTH_NAMES[bootDate.getMonth()].substring(0,3)} ${bootDate.getFullYear()}`;

  const isRecentRestart = stat.last_restart_time 
    ? (Date.now() - new Date(stat.last_restart_time).getTime()) < 24 * 60 * 60 * 1000
    : false;

  const isOffline = stat.current_uptime_seconds <= 300;
  const statusText = isOffline
    ? 'Offline'
    : (isRecentRestart ? 'Restarted' : 'Online');

  const statusColor = isOffline || isRecentRestart ? '#EF4444' : '#15803d';
  const statusBg = isOffline || isRecentRestart ? '#FEF2F2' : '#F0FDF4';

  const uptime = formatUptimeHero(stat.current_uptime_seconds);
  const uptimePercent = stat.availability_pct;

  // Pre-fetch 30d history
  const defaultHistoryKey = `${stat.itemid}-preset-30`;
  const history = customHistoryCache[defaultHistoryKey] || [];
  
  let minUptime = '---';
  let maxUptime = '---';
  
  if (history.length > 0) {
    const validMins = history.map(h => Number(h.min_uptime_seconds)).filter(v => v > 0);
    const validMaxs = history.map(h => Number(h.max_uptime_seconds)).filter(v => v > 0);
    if (validMins.length > 0) minUptime = formatUptimeShort(Math.min(...validMins));
    if (validMaxs.length > 0) maxUptime = formatUptimeShort(Math.max(...validMaxs));
  }

 useEffect(() => {
    if (!customHistoryCache[defaultHistoryKey]) {
      getUptimeHistory(stat.itemid).then(data => {
        setCustomHistoryCache(prev => ({ ...prev, [defaultHistoryKey]: data }));
      }).catch(err => console.error("Failed to load pre-fetch uptime history", err));
    }
  }, [stat.itemid, customHistoryCache, setCustomHistoryCache, defaultHistoryKey]);

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ease-out
        ${isExpanded ? 'shadow-lg ring-1 ring-[#2B5BA8]/20' : 'shadow-sm hover:shadow-md border border-[#E2E8F0]'}`}
    >
      {/* Collapsed Header */}
      <div
        className="cursor-pointer select-none transition-colors duration-200 hover:bg-[#FAFCFF] p-5 flex flex-col gap-4"
        onClick={onToggle}
      >
        {/* Top Row: Server Name & Status badge + Chevron */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F1F5F9] text-[#64748B] flex-shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2.5">
              <h3 className="text-[18px] font-bold text-[#0F172A] truncate">{stat.host}</h3>
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusBg, color: statusColor }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOffline || isRecentRestart ? 'animate-pulse' : ''
                  }`}
                  style={{ backgroundColor: statusColor }}
                />
                {statusText}
              </span>
            </div>
          </div>
          
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors flex-shrink-0"
          >
            <ChevronDown
              className={`w-4 h-4 text-[#64748B] transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Middle Row: Ring + Hero Uptime */}
        <div className="flex items-center gap-4">
          {/* Uptime Ring */}
          <div className="relative flex-shrink-0">
            <UptimeRing percentage={uptimePercent} color={statusColor === '#15803d' ? '#2B5BA8' : '#EF4444'} size={56} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] font-bold text-[#64748B]">{formatPercent(uptimePercent)}%</span>
            </div>
          </div>

          {/* Uptime Hero Number */}
          <div>
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className="text-[24px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                {uptime.days}
              </span>
              <span className="text-[15px] font-bold text-[#94A3B8] mr-2">d</span>
              <span className="text-[24px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                {uptime.hours}
              </span>
              <span className="text-[15px] font-bold text-[#94A3B8] mr-2">h</span>
              <span className="text-[24px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                {uptime.minutes}
              </span>
              <span className="text-[15px] font-bold text-[#94A3B8]">m</span>
            </div>
            <p className="text-[15px] text-[#94A3B8]">{bootDateStr}</p>
            {/* Calculation explanation */}
            <p className="text-[12px] text-label mt-1">
              Ring {formatPercent(uptimePercent)}% = availability over the last 30 days
            </p>
          </div>
        </div>

        {/* Bottom Row: Mini Stat Pills (full card width grid) */}
        <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-[#F1F5F9]">
          {[
            { label: 'MIN UPTIME', value: minUptime },
            { label: 'MAX UPTIME', value: maxUptime },
            { label: 'RESTARTS', value: String(stat.restart_count), danger: stat.restart_count > 0 },
          ].map((pill, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-2 px-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]"
            >
              <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold mb-1 text-center truncate w-full">{pill.label}</span>
              <span className={`text-[18px] font-extrabold ${pill.danger ? 'text-[#EF4444]' : 'text-[#0F172A]'} truncate w-full text-center`}>
                {pill.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <ExpandedUptimePanel 
          stat={stat}
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

interface UptimeSectionProps {
  data: UptimeStat[];
}

const UptimeSection: React.FC<UptimeSectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, UptimeHistoryPoint[]>>({});

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 rounded-full bg-[#2B5BA8]" />
        <h3 className="text-[15px] font-semibold text-[#0F172A]">Server Uptime</h3>
        <span className="text-[15px] text-[#94A3B8] font-medium ml-1">
          {data.length} {data.length === 1 ? 'server' : 'servers'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 transition-all duration-300">
        {data.map(stat => {
          const isExpanded = expandedItemId === stat.itemid;
          return (
            <div
              key={stat.itemid}
              className={`transition-all duration-300 ease-out ${
                isExpanded ? 'lg:col-span-2' : 'lg:col-span-1'
              }`}
            >
              <UptimeCard 
                stat={stat} 
                isExpanded={isExpanded}
                onToggle={() => setExpandedItemId(prev => prev === stat.itemid ? null : stat.itemid)}
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

export default UptimeSection;
