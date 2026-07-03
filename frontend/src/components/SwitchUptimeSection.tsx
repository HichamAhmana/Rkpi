import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp, Network } from 'lucide-react';
import {
  getSwitchUptimeHistory,
  getSwitchUptimeAvailablePeriods,
  type SwitchUptimeStat,
  type SwitchUptimeHistoryPoint,
  type AvailablePeriod,
} from '../services/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Formatting helpers ───────────────────────────────────────────────────────

const formatUptimeFull = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d} days, ${h}h ${m}m`;
};

const formatUptimeShort = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatBootDate = (seconds: number): string => {
  const boot = new Date(Date.now() - seconds * 1000);
  const day = boot.getDate();
  const month = MONTH_NAMES[boot.getMonth()].substring(0, 3);
  const year = boot.getFullYear();
  const hh = String(boot.getHours()).padStart(2, '0');
  const mm = String(boot.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hh}:${mm}`;
};

const formatBootDateShort = (seconds: number): string => {
  const boot = new Date(Date.now() - seconds * 1000);
  const day = boot.getDate();
  const month = MONTH_NAMES[boot.getMonth()].substring(0, 3);
  const year = boot.getFullYear();
  return `${day} ${month} ${year}`;
};

const formatLastRestart = (dateStr: string | null): string => {
  if (!dateStr) return 'No restart detected';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}`;
};

// ─── Expanded Panel ───────────────────────────────────────────────────────────

interface ExpandedSwitchPanelProps {
  stat: SwitchUptimeStat;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, SwitchUptimeHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, SwitchUptimeHistoryPoint[]>>>;
}

const ExpandedSwitchPanel: React.FC<ExpandedSwitchPanelProps> = ({
  stat,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache,
}) => {
  const [activePreset, setActivePreset] = useState<number | null>(30);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const itemid = stat.itemid;

  // Load available periods on first open (lazy)
  useEffect(() => {
    if (!availablePeriodsCache[itemid]) {
      getSwitchUptimeAvailablePeriods(itemid)
        .then((periods) => setAvailablePeriodsCache((prev) => ({ ...prev, [itemid]: periods })))
        .catch((err) => console.error('Failed to load switch periods', err));
    }
  }, [itemid, availablePeriodsCache, setAvailablePeriodsCache]);

  const periods = availablePeriodsCache[itemid] || [];
  const years = Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a);
  const monthsForSelectedYear = periods
    .filter((p) => p.year === selectedYear)
    .map((p) => p.month)
    .sort((a, b) => b - a);

  const currentSelectionParams = useMemo(() => {
    if (activePreset !== null) {
      if (activePreset === 30) {
        return { key: `sw-${itemid}-preset-30`, from: undefined, to: undefined };
      }
      const to = Math.floor(Date.now() / 1000);
      const from = to - activePreset * 24 * 60 * 60;
      return { key: `sw-${itemid}-preset-${activePreset}`, from, to: undefined };
    } else if (selectedYear && selectedMonth) {
      const from = Math.floor(new Date(selectedYear, selectedMonth - 1, 1).getTime() / 1000);
      const to = Math.floor(new Date(selectedYear, selectedMonth, 1).getTime() / 1000) - 1;
      return { key: `sw-${itemid}-custom-${selectedYear}-${selectedMonth}`, from, to };
    }
    return null;
  }, [itemid, activePreset, selectedYear, selectedMonth]);

  // Fetch history
  useEffect(() => {
    if (!currentSelectionParams) return;
    const { key, from, to } = currentSelectionParams;
    if (customHistoryCache[key]) { setError(false); return; }

    let isMounted = true;
    setLoading(true);
    setError(false);

    getSwitchUptimeHistory(itemid, from, to)
      .then((history) => {
        if (isMounted) {
          setCustomHistoryCache((prev) => ({ ...prev, [key]: history }));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load switch history', err);
        if (isMounted) { setError(true); setLoading(false); }
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, itemid]);

  const currentHistory: SwitchUptimeHistoryPoint[] =
    currentSelectionParams && customHistoryCache[currentSelectionParams.key]
      ? customHistoryCache[currentSelectionParams.key]
      : [];

  const handlePresetClick = (days: number) => {
    setActivePreset(days);
    setSelectedYear(null);
    setSelectedMonth(null);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
    const validMonths = periods.filter((p) => p.year === year).map((p) => p.month);
    setSelectedMonth(validMonths.length > 0 ? Math.max(...validMonths) : null);
    setActivePreset(null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value));
    setActivePreset(null);
  };

  // Chart data — bars colored by restart status
  const chartData = currentHistory.map((pt) => ({
    x: pt.day,
    y: Number((pt.max_uptime_seconds / 86400).toFixed(2)),
    had_restart: Number(pt.had_restart),
    max_uptime_seconds: pt.max_uptime_seconds,
  }));

  const barColors = chartData.map((d) => (d.had_restart === 1 ? '#EF4444' : '#2B5BA8'));

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
      },
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
        formatter: (value: string) => {
          if (!value) return '';
          const d = new Date(value);
          return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
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
        formatter: (val: number) => `${val.toFixed(0)}d`,
        style: { colors: '#94A3B8', fontSize: '11px' },
      },
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
            text: '1 day',
          },
        },
      ],
    },
    tooltip: {
      custom: ({ seriesIndex, dataPointIndex, w }: any) => {
        const d = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(d.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const statusColor = d.had_restart === 1 ? '#EF4444' : '#2B5BA8';
        const statusText = d.had_restart === 1 ? 'Restarted' : 'Stable';
        return `
          <div style="padding:10px 13px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,0.14);border-radius:10px;border:1px solid #E2E8F0;font-family:Inter,sans-serif;min-width:148px">
            <div style="font-size:11px;font-weight:700;color:#0F172A;margin-bottom:7px">${dayStr}</div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px">
              <span style="font-size:11px;color:#94A3B8">Uptime</span>
              <span style="font-size:13px;font-weight:700;color:#0F172A">${formatUptimeShort(d.max_uptime_seconds)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:6px">
              <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};flex-shrink:0"></span>
              <span style="font-size:11px;font-weight:600;color:${statusColor}">${statusText}</span>
            </div>
          </div>
        `;
      },
    },
  };

  const series = [{ name: 'Uptime', data: chartData }];

  const periodLabel = activePreset
    ? `Last ${activePreset} days`
    : selectedYear && selectedMonth
    ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
    : 'Custom range';

  const portPct =
    stat.total_ports > 0
      ? ((stat.up_ports / stat.total_ports) * 100).toFixed(1)
      : '0.0';

  // Interpretation
  const interpretLine1 =
    stat.restart_count === 0
      ? `• ${stat.switch_name} stable — aucun redémarrage détecté. Uptime actuel: ${formatUptimeFull(stat.current_uptime_seconds)}.`
      : `• ${stat.restart_count} redémarrage(s) détecté(s) sur la période. Dernier: ${formatLastRestart(stat.last_restart_time)}.`;
  const interpretLine2 = `• ${stat.up_ports}/${stat.total_ports} ports actifs — disponibilité réseau: ${portPct}%.`;

  return (
    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-5 px-6 flex flex-col gap-6 overflow-hidden transition-all duration-300">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Left — Stats (30%) */}
        <div className="w-full md:w-[30%] flex flex-col gap-3">

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Current uptime</span>
            <span className="text-[14px] font-bold text-[#0F172A]">
              {formatUptimeFull(stat.current_uptime_seconds)}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Boot date</span>
            <span className="text-[14px] font-bold text-[#0F172A]">
              {formatBootDate(stat.current_uptime_seconds)}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Restarts (30d)</span>
            <span
              className="text-[14px] font-bold"
              style={{ color: stat.restart_count > 0 ? '#EF4444' : '#3DBE7A' }}
            >
              {stat.restart_count}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Last restart</span>
            <span
              className="text-[14px] font-bold"
              style={{ color: stat.last_restart_time ? '#0F172A' : '#3DBE7A' }}
            >
              {formatLastRestart(stat.last_restart_time)}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Total ports</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{stat.total_ports}</span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Ports up</span>
            <span className="text-[14px] font-bold text-[#3DBE7A]">{stat.up_ports}</span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Ports down</span>
            <span
              className="text-[14px] font-bold"
              style={{ color: stat.down_ports > 0 ? '#EF4444' : '#3DBE7A' }}
            >
              {stat.down_ports}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[#94A3B8] text-[12px] mb-1">Monitoring period</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{periodLabel}</span>
          </div>
        </div>

        {/* Right — Chart (70%) */}
        <div className="w-full md:w-[70%] flex flex-col">
          {/* Header + time selector */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4">
            <div>
              <h4 className="text-[14px] font-semibold text-[#0F172A] mb-0.5">
                {stat.switch_name} — Uptime History
              </h4>
              <p className="text-[12px] text-[#94A3B8]">
                Blue = stable · Red = restart detected
              </p>
            </div>

            {/* Time range selector */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-[#F1F5F9] rounded-lg p-1">
                  {[7, 15, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => handlePresetClick(days)}
                      className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                        activePreset === days
                          ? 'bg-[#2563B0] text-white shadow-sm'
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
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2563B0] cursor-pointer"
                    value={selectedYear || ''}
                    onChange={handleYearChange}
                  >
                    <option value="" disabled>Year</option>
                    {years.map((yr) => (<option key={yr} value={yr}>{yr}</option>))}
                  </select>

                  <select
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2563B0] cursor-pointer"
                    value={selectedMonth || ''}
                    onChange={handleMonthChange}
                    disabled={!selectedYear}
                  >
                    <option value="" disabled>Month</option>
                    {monthsForSelectedYear.map((m) => (
                      <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="text-[11px] font-medium text-[#2563B0] bg-[rgba(37,99,176,0.1)] px-2 py-0.5 rounded-full">
                {activePreset
                  ? `Showing last ${activePreset} days from today`
                  : selectedYear && selectedMonth
                  ? `Showing: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                  : 'Custom range'}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[180px] w-full relative">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="skeleton w-full h-[160px] rounded-lg" />
              </div>
            ) : error ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-[#E2E8F0] rounded-lg">
                <p className="text-[#94A3B8] text-[13px] mb-2">Unable to load chart data</p>
                <button
                  onClick={() =>
                    setCustomHistoryCache((prev) => {
                      const next = { ...prev };
                      delete next[currentSelectionParams!.key];
                      return next;
                    })
                  }
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

          {/* Interpretation panel */}
          <div
            className="mt-4 p-4 rounded-md border text-[13px] text-[#475569]"
            style={{
              borderLeft: '4px solid #2563B0',
              backgroundColor: '#F8FAFC',
              borderColor: '#E2E8F0',
              borderLeftColor: '#2563B0',
            }}
          >
            <div className="text-[13px] font-semibold text-[#0F172A] mb-2">KPI Interpretation</div>
            <div className="space-y-1">
              <p>{interpretLine1}</p>
              <p>{interpretLine2}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Switch Card ──────────────────────────────────────────────────────────────

interface SwitchCardProps {
  stat: SwitchUptimeStat;
  isExpanded: boolean;
  onToggle: () => void;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, SwitchUptimeHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, SwitchUptimeHistoryPoint[]>>>;
}

const SwitchCard: React.FC<SwitchCardProps> = ({
  stat,
  isExpanded,
  onToggle,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache,
}) => {
  const portPct =
    stat.total_ports > 0
      ? Number(((stat.up_ports / stat.total_ports) * 100).toFixed(1))
      : 0;

  const isStable = stat.restart_count === 0;
  const statusColor = isStable ? '#10B981' : '#F59E0B';
  const statusBg = isStable ? '#ECFDF5' : '#FFFBEB';
  const statusText = isStable ? 'Stable' : 'Restarted';

  return (
    <div
      className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ease-out flex flex-col
        ${isExpanded ? 'shadow-lg ring-1 ring-[#2563B0]/20' : 'shadow-sm hover:shadow-md border-[#E2E8F0]'}`}
    >
      {/* Card Header (clickable) */}
      <div
        className="p-5 cursor-pointer select-none transition-colors duration-200 hover:bg-[#FAFCFF] flex flex-col gap-4"
        onClick={onToggle}
      >
        {/* Top Row: Name & Status badge + Chevron */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: isStable ? '#ECFDF5' : '#FFFBEB',
                color: statusColor
              }}
            >
              <Network className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold text-[#0F172A] truncate">{stat.switch_name}</h3>
              <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wider">Network Switch</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusBg, color: statusColor }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${!isStable ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: statusColor }}
              />
              {statusText}
            </span>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#64748B]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#64748B]" />
              )}
            </div>
          </div>
        </div>

        {/* Middle Row: Uptime display */}
        <div>
          <div className="text-[24px] font-extrabold text-[#0F172A] mb-0.5 leading-none">
            {formatUptimeFull(stat.current_uptime_seconds)}
          </div>
          <div className="text-[11px] text-[#94A3B8]">
            Since {formatBootDateShort(stat.current_uptime_seconds)}
          </div>
        </div>

        {/* Port Availability progress bar */}
        <div className="bg-[#F8FAFC] border border-[#F1F5F9] p-3.5 rounded-xl">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Port Connectivity</span>
            <span className="text-[12px] font-extrabold text-[#0F172A]">
              {stat.up_ports}/{stat.total_ports} ports &middot; {portPct}%
            </span>
          </div>
          <div className="w-full h-[6px] bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${portPct}%`,
                backgroundColor: portPct >= 95 ? '#3DBE7A' : portPct >= 80 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
          {/* Calculation explanation */}
          <p className="text-[10px] text-label mt-1.5">
            {portPct}% = {stat.up_ports} ports up ÷ {stat.total_ports} total × 100
          </p>
        </div>

        {/* Bottom Row: Mini Stat Pills (full card width grid - 4 columns) */}
        <div className="grid grid-cols-4 gap-2 pt-3.5 border-t border-[#F1F5F9]">
          {[
            { 
              label: 'MIN UPTIME', 
              value: stat.min_uptime_seconds !== null ? formatUptimeShort(stat.min_uptime_seconds) : '—',
              color: stat.min_uptime_seconds !== null && stat.min_uptime_seconds < stat.current_uptime_seconds * 0.5 ? '#F59E0B' : '#0F172A'
            },
            { 
              label: 'RESTARTS', 
              value: String(stat.restart_count),
              color: stat.restart_count > 0 ? '#EF4444' : '#3DBE7A',
            },
            { 
              label: 'PORTS UP', 
              value: `${stat.up_ports}/${stat.total_ports}`,
              color: '#3DBE7A'
            },
            { 
              label: 'PORTS DOWN', 
              value: String(stat.down_ports),
              color: stat.down_ports > 0 ? '#EF4444' : '#3DBE7A',
            },
          ].map((pill, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-2 px-1 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]"
            >
              <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold mb-1 text-center truncate w-full">{pill.label}</span>
              <span 
                className="text-[12px] font-extrabold truncate w-full text-center"
                style={{ color: pill.color }}
              >
                {pill.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <ExpandedSwitchPanel
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

// ─── Section ──────────────────────────────────────────────────────────────────

interface SwitchUptimeSectionProps {
  data: SwitchUptimeStat[];
  isLoading?: boolean;
}

const SwitchUptimeSection: React.FC<SwitchUptimeSectionProps> = ({ data, isLoading = false }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, SwitchUptimeHistoryPoint[]>>({});

  if ((!data || data.length === 0) && !isLoading) return null;

  if (!data || data.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            Network Switches — Uptime &amp; Availability
          </h3>
          <p className="text-[13px] text-[#94A3B8] mt-0.5">
            All 6 switches monitored via SNMP
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#E2E8F0] p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="skeleton w-28 h-4 mb-3" />
              <div className="skeleton w-16 h-7 mb-2" />
              <div className="skeleton w-44 h-3 mb-3" />
              <div className="skeleton w-full h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="mb-4">
        <h3 className="text-[16px] font-semibold text-[#0F172A]">
          Network Switches — Uptime &amp; Availability
        </h3>
        <p className="text-[13px] text-[#94A3B8] mt-0.5">
          All 6 switches monitored via SNMP
        </p>
      </div>

      {/* 3 per row on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 transition-all duration-300">
        {data.map((stat) => {
          const isExpanded = expandedItemId === stat.itemid;
          return (
            <div
              key={stat.itemid}
              className={`transition-all duration-300 ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
            >
              <SwitchCard
                stat={stat}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedItemId((prev) => (prev === stat.itemid ? null : stat.itemid))
                }
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

export default SwitchUptimeSection;
