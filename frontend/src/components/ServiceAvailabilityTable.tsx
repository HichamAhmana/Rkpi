import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  getServiceHistory,
  getServiceAvailablePeriods,
  type ServerServices,
  type HistoryPoint,
  type AvailablePeriod,
  type ServiceItem,
} from '../services/api';

interface ServiceAvailabilityTableProps {
  data: ServerServices[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  running: { bg: '#ECFDF5', text: '#059669', dot: '#059669', label: 'Running' },
  anomaly: { bg: '#FFFBEB', text: '#D97706', dot: '#D97706', label: 'Anomaly' },
  stopped: { bg: '#FEF2F2', text: '#DC2626', dot: '#DC2626', label: 'Stopped' },
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

const StatusBadge: React.FC<{ currentState: string; incidentDays: number }> = ({ currentState, incidentDays }) => {
  const status = getStatusForService(currentState, incidentDays);
  const config = statusConfig[status] || statusConfig.stopped;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
};

// --- Sparkline Component (for the table row) ---

const ServiceSparkline: React.FC<{ history: HistoryPoint[]; isRunning: boolean }> = ({ history, isRunning }) => {
  const color = isRunning ? '#3DBE7A' : '#EF4444';

  const chartOptions: ApexOptions = {
    chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
    colors: [color],
    stroke: { curve: 'smooth', width: 1.5 },
    fill: { type: 'solid', opacity: 0.2 },
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

  return <Chart options={chartOptions} series={series} type="area" width="100%" height="100%" />;
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

  // Load available periods on mount
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
      // Don't send from/to — let backend use MAX(clock) as default
      return { key: `${itemid}-preset-${activePreset}`, from: undefined, to: undefined };
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
    
    // If it's the 30 day preset, we already have defaultHistory
    if (activePreset === 30 && defaultHistory.length > 0) {
      return; 
    }

    const { key, from, to } = currentSelectionParams;
    if (customHistoryCache[key]) {
      
      return; // Already cached
    }

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
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
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, defaultHistory, itemid, activePreset]);

  // Resolve current history to display
  let currentHistory: HistoryPoint[] = [];
  if (activePreset === 30) {
    currentHistory = defaultHistory;
  } else if (currentSelectionParams && customHistoryCache[currentSelectionParams.key]) {
    currentHistory = customHistoryCache[currentSelectionParams.key];
  }

  // Group by day MAX
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
    // If current selected month is not in the new year, pick the most recent one
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

  // Chart Configuration
  const annotations = chartData.filter(d => d.value > 0).map(d => ({
    x: new Date(d.time).getTime(),
    marker: {
      size: 5,
      fillColor: '#EF4444',
      strokeColor: '#EF4444',
      radius: 2,
    },
    label: {
      borderColor: '#EF4444',
      style: { color: '#fff', background: '#EF4444' },
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
    colors: ['#3DBE7A'],
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.0,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
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
      show: true,
      min: 0,
      max: 1,
      tickAmount: 1,
      labels: {
        formatter: (val) => val === 0 ? 'Running' : 'Problem',
        style: { colors: '#94A3B8', fontSize: '11px' }
      }
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy'
      },
      y: {
        formatter: (val) => val === 0 ? 'Running' : 'Issue',
        title: { formatter: () => '' }
      }
    },
    annotations: {
      points: annotations
    }
  };

  const series = [{
    name: 'State',
    data: chartData.map(pt => ({
      x: new Date(pt.time).getTime(),
      y: pt.value > 0 ? 1 : 0
    }))
  }];

  const periodLabel = activePreset ? `Last ${activePreset} days` : (selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Custom range');

  return (
    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-5 px-6 flex flex-col md:flex-row gap-8 overflow-hidden transition-all duration-300">
      
      {/* Left side — Stats summary */}
      <div className="w-full md:w-[30%] flex flex-col">
        <h4 className="text-[16px] font-bold text-[#0F172A] mb-4">{service.service_name}</h4>
        
        <div className="flex flex-col gap-3">
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Current state</span>
            <div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium"
                style={{ backgroundColor: badgeConfig.bg, color: badgeConfig.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badgeConfig.dot }} />
                {badgeConfig.label}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Incidents (30d)</span>
            <span className={`text-[14px] font-bold ${service.incident_days === 0 ? 'text-[#3DBE7A]' : 'text-[#F59E0B]'}`}>
              {service.incident_days}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Last incident</span>
            <span className={`text-[14px] font-bold ${!service.last_incident ? 'text-[#3DBE7A]' : 'text-[#0F172A]'}`}>
              {formatLastIncident(service.last_incident)}
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
              {service.service_name} — Service State
            </h4>
            <p className="text-[12px] text-[#94A3B8]">
              0 = Running · Any value above 0 = Issue
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
            <Chart options={chartOptions} series={series} type="area" width="100%" height="100%" />
          )}
        </div>
      </div>

    </div>
  );
};


// --- Main Table Component ---

const ServiceAvailabilityTable: React.FC<ServiceAvailabilityTableProps> = ({ data }) => {
  const [historyMap, setHistoryMap] = useState<Record<number, HistoryPoint[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [expandedRowItemId, setExpandedRowItemId] = useState<number | null>(null);

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

  const toggleRow = (itemid: number) => {
    setExpandedRowItemId(prev => prev === itemid ? null : itemid);
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
        <div className="text-[#94A3B8] text-[14px]">No service availability data</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-[#E2E8F0]">
        <h3 className="text-[16px] font-semibold text-[#0F172A]">Service Availability</h3>
      </div>

      {data.map((server) => (
        <div key={server.server_name}>
          <div className="px-6 pt-4 pb-2">
            <span
              className="inline-block px-3 py-1 rounded-full text-[13px] font-semibold"
              style={{ backgroundColor: 'rgba(43, 91, 168, 0.1)', color: '#2B5BA8' }}
            >
              {server.server_name}
            </span>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Incidents (30d)</th>
                  <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Last Incident</th>
                  <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">30-day History</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {server.services.map((svc) => {
                  const isExpanded = expandedRowItemId === svc.itemid;
                  
                  return (
                    <React.Fragment key={`${server.server_name}-${svc.itemid}`}>
                      <tr
                        onClick={() => toggleRow(svc.itemid)}
                        className={`border-b border-[#F1F5F9] transition-colors duration-150 cursor-pointer ${
                          isExpanded ? 'bg-[#FAFBFF]' : 'hover:bg-[#FAFBFF]'
                        }`}
                      >
                        <td className="px-6 py-3.5 text-[14px] font-medium text-[#0F172A]">
                          {svc.service_name}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge currentState={svc.current_state} incidentDays={svc.incident_days} />
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className="text-[14px] font-semibold"
                            style={{ color: svc.incident_days === 0 ? '#3DBE7A' : '#F59E0B' }}
                          >
                            {svc.incident_days}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[13px] text-[#94A3B8]">
                          {formatLastIncident(svc.last_incident)}
                        </td>
                        <td className="px-6 py-3.5">
                          {loadingMap[svc.itemid] ? (
                            <div className="skeleton w-[180px] h-[50px] bg-[#E2E8F0] animate-pulse" />
                          ) : (
                            <div className="w-[180px] h-[50px] flex items-center">
                              <ServiceSparkline
                                history={historyMap[svc.itemid] || []}
                                isRunning={String(svc.current_state) === '0'}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[#94A3B8]">
                          <div className="flex justify-end items-center pr-2">
                             {isExpanded ? (
                               <ChevronUp className="w-5 h-5 transition-transform duration-200" />
                             ) : (
                               <ChevronDown className="w-5 h-5 transition-transform duration-200" />
                             )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Panel Row */}
                      {isExpanded && (
                        <tr className="bg-[#FAFBFF]">
                          <td colSpan={6} className="p-0 border-b border-[#E2E8F0]">
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
      ))}
    </div>
  );
};

export default ServiceAvailabilityTable;
