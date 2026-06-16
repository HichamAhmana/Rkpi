import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
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
  return `${day} ${month} · ${hours}:${minutes}`;
};

const getColorForAvailability = (pct: number) => {
  if (pct >= 99.9) return '#3DBE7A';
  if (pct >= 99.0) return '#F59E0B';
  return '#EF4444';
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

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

  // Resolve current history to display
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
    x: pt.day, // raw ISO string from DB, we format in ApexCharts
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
      type: 'datetime',
      min: currentSelectionParams?.from ? currentSelectionParams.from * 1000 : undefined,
      max: currentSelectionParams?.to ? currentSelectionParams.to * 1000 : undefined,
      labels: {
        formatter: function (value) {
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
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: (val) => `${val}%`,
        style: { colors: '#94A3B8', fontSize: '11px' }
      }
    },
    tooltip: {
      custom: function({ seriesIndex, dataPointIndex, w }: any) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(data.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        return `
          <div class="px-3 py-2 bg-white shadow-lg rounded border border-[#E2E8F0] text-[12px] text-[#0F172A]">
            <div class="font-bold mb-1">${dayStr}</div>
            <div><span class="font-semibold text-[#64748B]">Available:</span> ${data.y}%</div>
            <div><span class="font-semibold text-[#64748B]">Outages:</span> ${data.outages}</div>
          </div>
        `;
      }
    }
  };

  const series = [{
    name: 'Availability',
    data: chartData
  }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');

  const currentStatusLabel = String(agent.current_status) === '1' ? 'Available' : 'Unavailable';
  const currentStatusDot = String(agent.current_status) === '1' ? '#3DBE7A' : '#EF4444';

  return (
    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-5 px-6 flex flex-col md:flex-row gap-8 overflow-hidden transition-all duration-300">
      
      {/* Left side — Stats summary */}
      <div className="w-full md:w-[30%] flex flex-col">
        
        <div className="flex flex-col gap-3">
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Current status</span>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatusDot }} />
               <span className="text-[14px] font-semibold text-[#0F172A]">{currentStatusLabel}</span>
            </div>
          </div>
          
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Availability (30d)</span>
            <span className="text-[14px] font-bold text-[#0F172A]">
              {Number(agent.availability_pct).toFixed(4)}%
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Total checks (30d)</span>
            <span className="text-[14px] font-bold text-[#0F172A]">
              {formatNumber(agent.total_checks)}
            </span>
          </div>
          
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Outage occurrences (30d)</span>
            <span className={`text-[14px] font-bold ${agent.unavailable_checks === 0 ? 'text-[#3DBE7A]' : 'text-[#F59E0B]'}`}>
              {formatNumber(agent.unavailable_checks)}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Last outage</span>
            <span className={`text-[14px] font-bold ${!agent.last_unavailable ? 'text-[#3DBE7A]' : 'text-[#0F172A]'}`}>
              {formatLastOutage(agent.last_unavailable)}
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
              {agent.host} — Daily Agent Availability
            </h4>
            <p className="text-[12px] text-[#94A3B8]">
              Each bar = 1 day. Green = 100%, Orange = degraded, Red = critical
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Presets */}
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

              {/* Dropdowns */}
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
  );
};


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

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-sm flex flex-col">
      {/* Header Area (Clickable) */}
      <div 
        className="p-6 cursor-pointer hover:bg-[#FAFBFF] transition-colors duration-150 border-l-[4px]"
        style={{ borderLeftColor: '#3A9DBF' }}
        onClick={onToggle}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#0F172A]">{agent.host}</h3>
            <p className="text-[13px] text-[#94A3B8]">Zabbix Agent Availability</p>
          </div>
          <div className="text-[#94A3B8]">
             {isExpanded ? (
               <ChevronUp className="w-5 h-5 transition-transform duration-200" />
             ) : (
               <ChevronDown className="w-5 h-5 transition-transform duration-200" />
             )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <span className="text-[36px] font-bold leading-none tracking-tight" style={{ color }}>
              {pctNum.toFixed(2)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-[8px] bg-[#E2E8F0] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${pctNum}%`, backgroundColor: color }}
            />
          </div>

          {/* Stat Pills */}
          <div className="flex flex-wrap gap-3 mt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3DBE7A]" />
              <span className="text-[12px] text-[#475569]">Available: <strong className="text-[#0F172A]">{formatNumber(availableChecks)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] shadow-sm">
              <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
              <span className="text-[12px] text-[#475569]">Outages: <strong className="text-[#0F172A]">{formatNumber(agent.unavailable_checks)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] shadow-sm">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="text-[12px] text-[#475569]">Last outage: <strong className={`text-[12px] font-bold ${!agent.last_unavailable ? 'text-[#3DBE7A]' : 'text-[#0F172A]'}`}>{formatLastOutage(agent.last_unavailable)}</strong></span>
            </div>
          </div>
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


interface AgentAvailabilitySectionProps {
  data: AgentStat[];
}

const AgentAvailabilitySection: React.FC<AgentAvailabilitySectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  // Lifted caches for periods and custom history to persist across toggles
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, AgentHistoryPoint[]>>({});

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 transition-all duration-300">
        {data.map(agent => {
          const isExpanded = expandedItemId === agent.itemid;
          return (
            <div
              key={agent.itemid}
              className={`transition-all duration-300 ${
                isExpanded ? 'xl:col-span-2' : 'xl:col-span-1'
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
