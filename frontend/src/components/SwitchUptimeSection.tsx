import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
      const to = Math.floor(Date.now() / 1000);
      const from = to - activePreset * 24 * 3600;
      return { key: `sw-${itemid}-preset-${activePreset}`, from, to };
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
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: barColors,
    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: '60%',
        distributed: true,
      },
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
        formatter: (value: string) => {
          if (!value) return '';
          const d = new Date(value);
          return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
        },
        style: { colors: '#94A3B8', fontSize: '11px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
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
          borderColor: '#94A3B8',
          strokeDashArray: 4,
          label: {
            borderColor: '#94A3B8',
            style: { color: '#fff', background: '#94A3B8', fontSize: '10px' },
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
        const uptimeStr = formatUptimeShort(d.max_uptime_seconds);
        const statusStr = d.had_restart === 1
          ? `<span style="color:#EF4444;font-weight:600">↻ Restarted</span>`
          : `<span style="color:#3DBE7A;font-weight:600">✓ Stable</span>`;
        return `
          <div class="px-3 py-2 bg-white shadow-lg rounded border border-[#E2E8F0] text-[12px] text-[#0F172A]">
            <div class="font-bold mb-1">${dayStr}</div>
            <div><span style="color:#64748B;font-weight:600">Uptime: </span>${uptimeStr}</div>
            <div>${statusStr}</div>
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

  const pill =
    stat.restart_count === 0
      ? { label: '🟢 Stable', bg: '#F0FDF4', color: '#15803d' }
      : { label: '🟡 Restarted', bg: '#FFFBEB', color: '#B45309' };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-sm flex flex-col">
      {/* Card header — always visible, clickable */}
      <div
        className="p-5 cursor-pointer hover:bg-[#FAFBFF] transition-colors duration-150 border-l-[4px]"
        style={{ borderLeftColor: '#2563B0' }}
        onClick={onToggle}
      >
        {/* Top row: name + pill + chevron */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-[18px] font-bold text-[#0F172A]">{stat.switch_name}</h3>
            <p className="text-[13px] text-[#94A3B8]">Network Switch</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              {pill.label}
            </span>
            <div className="text-[#94A3B8]">
              {isExpanded
                ? <ChevronUp className="w-5 h-5 transition-transform duration-200" />
                : <ChevronDown className="w-5 h-5 transition-transform duration-200" />}
            </div>
          </div>
        </div>

        {/* Uptime display */}
        <div className="mb-4">
          <div className="text-[28px] font-bold leading-none tracking-tight text-[#0F172A] mb-1">
            {formatUptimeFull(stat.current_uptime_seconds)}
          </div>
          <div className="text-[13px] text-[#94A3B8]">
            Since {formatBootDateShort(stat.current_uptime_seconds)}
          </div>
        </div>

        {/* Stats row — 5 boxes */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[58px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Last</span>
            <span className="text-[12px] font-bold text-[#3DBE7A]">
              {formatUptimeShort(stat.current_uptime_seconds)}
            </span>
          </div>

          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[58px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Min</span>
            <span
              className="text-[12px] font-bold"
              style={{
                color:
                  stat.min_uptime_seconds !== null &&
                  stat.min_uptime_seconds < stat.current_uptime_seconds * 0.5
                    ? '#F59E0B'
                    : '#3DBE7A',
              }}
            >
              {stat.min_uptime_seconds !== null
                ? formatUptimeShort(stat.min_uptime_seconds)
                : '—'}
            </span>
          </div>

          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[58px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Restarts</span>
            <span
              className="text-[12px] font-bold"
              style={{ color: stat.restart_count > 0 ? '#EF4444' : '#3DBE7A' }}
            >
              {stat.restart_count}
            </span>
          </div>

          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[58px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Ports Up</span>
            <span className="text-[12px] font-bold text-[#3DBE7A]">
              {stat.up_ports}/{stat.total_ports}
            </span>
          </div>

          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[58px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Ports Down</span>
            <span
              className="text-[12px] font-bold"
              style={{ color: stat.down_ports > 0 ? '#EF4444' : '#3DBE7A' }}
            >
              {stat.down_ports}
            </span>
          </div>
        </div>

        {/* Port availability progress bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[12px] text-[#64748B]">Port availability</span>
            <span className="text-[12px] font-semibold text-[#0F172A]">
              {stat.up_ports}/{stat.total_ports} — {portPct}%
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
}

const SwitchUptimeSection: React.FC<SwitchUptimeSectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, SwitchUptimeHistoryPoint[]>>({});

  if (!data || data.length === 0) return null;

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
