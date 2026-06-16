import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  return `${d} days, ${h}h ${m}m`;
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

  // Determine the cache key and time range for the current selection
  const currentSelectionParams = useMemo(() => {
    if (activePreset !== null) {
      const to = Math.floor(Date.now() / 1000);
      const from = to - activePreset * 24 * 3600;
      return { key: `${itemid}-preset-${activePreset}`, from, to };
    } else if (selectedYear && selectedMonth) {
      const from = Math.floor(new Date(selectedYear, selectedMonth - 1, 1).getTime() / 1000);
      const to = Math.floor(new Date(selectedYear, selectedMonth, 1).getTime() / 1000) - 1;
      return { key: `${itemid}-custom-${selectedYear}-${selectedMonth}`, from, to };
    }
    return null;
  }, [itemid, activePreset, selectedYear, selectedMonth]);

  // Fetch data if needed
  useEffect(() => {
    if (!currentSelectionParams) return;
    
    const { key, from, to } = currentSelectionParams;
    if (customHistoryCache[key]) {
      setError(false);
      return; // Already cached
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

  // Resolve current history to display
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
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: barColors,
    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: '60%',
        distributed: true,
      }
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'category',
      labels: {
        formatter: function (value) {
          if (!value) return '';
          const d = new Date(value);
          return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0,3)}`;
        },
        style: { colors: '#94A3B8', fontSize: '11px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter: (val) => `${val.toFixed(0)} days`,
        style: { colors: '#94A3B8', fontSize: '11px' }
      }
    },
    annotations: {
      yaxis: [
        {
          y: 1,
          borderColor: '#94A3B8',
          strokeDashArray: 4,
          label: {
            borderColor: '#94A3B8',
            style: {
              color: '#fff',
              background: '#94A3B8'
            },
            text: '1 day threshold'
          }
        }
      ]
    },
    tooltip: {
      custom: function({ seriesIndex, dataPointIndex, w }: any) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(data.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const restartNotice = data.had_restart === 1 
          ? `<div class="text-[#EF4444] font-semibold mt-1">↻ Server restarted this day</div>` 
          : '';
        return `
          <div class="px-3 py-2 bg-white shadow-lg rounded border border-[#E2E8F0] text-[12px] text-[#0F172A]">
            <div class="font-bold mb-1">${dayStr}</div>
            <div><span class="font-semibold text-[#64748B]">Max uptime:</span> ${formatUptimeShort(data.max_uptime_seconds)}</div>
            ${restartNotice}
          </div>
        `;
      }
    }
  };

  const series = [{
    name: 'Uptime',
    data: chartData
  }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');
  const bootDate = new Date(Date.now() - stat.current_uptime_seconds * 1000);
  const bootDateStr = `${bootDate.getDate()} ${MONTH_NAMES[bootDate.getMonth()].substring(0,3)} ${bootDate.getFullYear()} at ${String(bootDate.getHours()).padStart(2, '0')}:${String(bootDate.getMinutes()).padStart(2, '0')}`;

  const currentPeriodRestarts = currentHistory.filter(pt => pt.had_restart === 1).length;

  let interpretationText = '';
  if (currentPeriodRestarts === 0) {
    interpretationText = `• No restarts detected in the selected period. Server has been running continuously for ${formatUptimeFull(stat.current_uptime_seconds)}.`;
  } else if (currentPeriodRestarts === 1) {
    interpretationText = `• 1 restart detected on ${formatLastRestart(stat.last_restart_time)}. Uptime dropped briefly and recovered.`;
  } else {
    interpretationText = `• ${currentPeriodRestarts} restarts detected. Review maintenance logs for planned/unplanned reboots.`;
  }

  return (
    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-5 px-6 flex flex-col gap-6 overflow-hidden transition-all duration-300">
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left side — Stats summary */}
        <div className="w-full md:w-[30%] flex flex-col">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
              <span className="text-[#94A3B8] text-[12px] mb-1">Current uptime</span>
              <span className="text-[14px] font-bold text-[#0F172A]">
                {formatUptimeFull(stat.current_uptime_seconds)}
              </span>
            </div>
            
            <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
              <span className="text-[#94A3B8] text-[12px] mb-1">Last restart</span>
              <span className={`text-[14px] font-bold ${!stat.last_restart_time ? 'text-[#3DBE7A]' : 'text-[#0F172A]'}`}>
                {formatLastRestartFull(stat.last_restart_time)}
              </span>
            </div>

            <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
              <span className="text-[#94A3B8] text-[12px] mb-1">Restart count (30d)</span>
              <span className={`text-[14px] font-bold ${stat.restart_count > 0 ? 'text-[#EF4444]' : 'text-[#3DBE7A]'}`}>
                {formatNumber(stat.restart_count)}
              </span>
            </div>
            
            <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
              <span className="text-[#94A3B8] text-[12px] mb-1">Boot time</span>
              <span className="text-[14px] font-bold text-[#0F172A]">
                {bootDateStr}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[#94A3B8] text-[12px] mb-1">Monitoring period</span>
              <span className="text-[14px] font-bold text-[#0F172A]">
                {periodLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right side — Full chart & Selector */}
        <div className="w-full md:w-[70%] flex flex-col">
          
          {/* Header with Title and Selector */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4">
            <div>
              <h4 className="text-[14px] font-semibold text-[#0F172A] mb-0.5">
                {stat.host} — Uptime History (30 days)
              </h4>
              <p className="text-[12px] text-[#94A3B8]">
                Blue = stable day · Red = restart detected
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-[#F1F5F9] rounded-lg p-1">
                  {[7, 15, 30].map(days => (
                    <button
                      key={days}
                      onClick={() => handlePresetClick(days)}
                      className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                        activePreset === days
                          ? 'bg-[#2B5BA8] text-white shadow-sm'
                          : 'text-[#64748B] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>

                <div className="w-[1px] h-6 bg-[#E2E8F0]" />

                <div className="flex items-center gap-2">
                  <select
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2B5BA8] cursor-pointer"
                    value={selectedYear || ''}
                    onChange={handleYearChange}
                  >
                    <option value="" disabled>Year</option>
                    {years.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>

                  <select
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2B5BA8] cursor-pointer"
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
              
              <span className="text-[11px] font-medium text-[#2B5BA8] bg-[rgba(43,91,168,0.1)] px-2 py-0.5 rounded-full">
                {activePreset ? `Showing last ${activePreset} days from today` : (selectedYear && selectedMonth ? `Showing: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range')}
              </span>
            </div>
          </div>

          {/* Chart Area */}
          <div className="h-[200px] w-full relative">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                 <div className="skeleton w-full h-[180px] rounded-lg" />
              </div>
            ) : error ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-[#E2E8F0] rounded-lg">
                <p className="text-[#94A3B8] text-[13px] mb-2">Unable to load chart data</p>
                <button 
                  onClick={() => setCustomHistoryCache(prev => { const next = {...prev}; delete next[currentSelectionParams!.key]; return next; })}
                  className="px-3 py-1.5 bg-[#F1F5F9] text-[#475569] text-[12px] font-medium rounded hover:bg-[#E2E8F0] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-white border border-[#E2E8F0] rounded-lg">
                <p className="text-[#94A3B8] text-[13px]">No data available for this period</p>
              </div>
            ) : (
              <Chart options={chartOptions} series={series} type="bar" width="100%" height="100%" />
            )}
          </div>
        </div>
      </div>
      
      {/* Interpretation Text */}
      <div className="text-[13px] text-[#475569] bg-white border border-[#E2E8F0] rounded-md p-3">
        {interpretationText}
      </div>

    </div>
  );
};


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
  const bootDateStr = `${bootDate.getDate()} ${MONTH_NAMES[bootDate.getMonth()].substring(0,3)} ${bootDate.getFullYear()}`;

  const isRecentRestart = stat.last_restart_time 
    ? (Date.now() - new Date(stat.last_restart_time).getTime()) < 24 * 60 * 60 * 1000
    : false;

  const isOffline = stat.current_uptime_seconds <= 300;
  const statusText = isOffline
    ? 'Offline'
    : (isRecentRestart ? 'Restarted Recently' : 'Online');

  // Compute Min/Max for the stat pills IF we have default history loaded
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

  // Pre-fetch 30d history to populate min/max in collapsed view
  useEffect(() => {
    if (!customHistoryCache[defaultHistoryKey]) {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 30 * 24 * 3600;
      getUptimeHistory(stat.itemid, from, to).then(data => {
        setCustomHistoryCache(prev => ({ ...prev, [defaultHistoryKey]: data }));
      }).catch(err => console.error("Failed to load pre-fetch uptime history", err));
    }
  }, [stat.itemid, customHistoryCache, setCustomHistoryCache, defaultHistoryKey]);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-sm flex flex-col">
      {/* Header Area (Clickable) */}
      <div 
        className="p-6 cursor-pointer hover:bg-[#FAFBFF] transition-colors duration-150 border-l-[4px]"
        style={{ borderLeftColor: '#2B5BA8' }}
        onClick={onToggle}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#0F172A]">{stat.host}</h3>
            <p className="text-[13px] text-[#94A3B8]">System Uptime</p>
          </div>
          <div className="flex items-center gap-3">
             <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${
               isOffline || isRecentRestart ? 'bg-[#FEF2F2] text-[#EF4444]' : 'bg-[#F0FDF4] text-[#15803d]'
             }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isOffline || isRecentRestart ? 'bg-[#EF4444] animate-pulse' : 'bg-[#15803d]'
                }`} />
                {statusText}
             </span>
             <div className="text-[#94A3B8]">
               {isExpanded ? (
                 <ChevronUp className="w-5 h-5 transition-transform duration-200" />
               ) : (
                 <ChevronDown className="w-5 h-5 transition-transform duration-200" />
               )}
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[32px] font-bold leading-none tracking-tight text-[#0F172A] mb-1">
              {formatUptimeFull(stat.current_uptime_seconds)}
            </div>
            <div className="text-[13px] text-[#94A3B8]">
              Since {bootDateStr}
            </div>
          </div>

          {/* Stat Pills */}
          <div className="flex flex-wrap gap-2 mt-1">
            <div className="flex flex-col px-3 py-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-semibold">Current</span>
              <span className="text-[13px] text-[#0F172A] font-medium">{formatUptimeShort(stat.current_uptime_seconds)}</span>
            </div>
            <div className="flex flex-col px-3 py-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-semibold">Min</span>
              <span className="text-[13px] text-[#0F172A] font-medium">{minUptime}</span>
            </div>
            <div className="flex flex-col px-3 py-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-semibold">Max</span>
              <span className="text-[13px] text-[#0F172A] font-medium">{maxUptime}</span>
            </div>
            <div className="flex flex-col px-3 py-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-semibold">Restarts</span>
              <span className={`text-[13px] font-medium ${stat.restart_count > 0 ? 'text-[#EF4444]' : 'text-[#3DBE7A]'}`}>{stat.restart_count}</span>
            </div>
            <div className="flex flex-col px-3 py-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-semibold">Last Restart</span>
              <span className={`text-[13px] font-medium ${!stat.last_restart_time ? 'text-[#3DBE7A]' : 'text-[#0F172A]'}`}>{formatLastRestart(stat.last_restart_time)}</span>
            </div>
          </div>
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


interface UptimeSectionProps {
  data: UptimeStat[];
}

const UptimeSection: React.FC<UptimeSectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  // Lifted caches for periods and custom history to persist across toggles
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, UptimeHistoryPoint[]>>({});

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-4">Server Uptime</h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 transition-all duration-300">
        {data.map(stat => {
          const isExpanded = expandedItemId === stat.itemid;
          return (
            <div
              key={stat.itemid}
              className={`transition-all duration-300 ${
                isExpanded ? 'xl:col-span-2' : 'xl:col-span-1'
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
