import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  getSfpPortHistory,
  getSfpAvailablePeriods,
  type SfpPortStat,
  type SfpHistoryPoint,
  type AvailablePeriod,
} from '../services/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatLastDown = (dateStr: string | null): string => {
  if (!dateStr) return 'Aucune coupure';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

const valueLabel = (v: number | string | null): string => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (n === 1) return 'Up';
  if (n === 2) return 'Down';
  return String(v);
};

const valueColor = (v: number | string | null): string => {
  if (v === null || v === undefined) return '#94A3B8';
  const n = Number(v);
  if (n === 1) return '#3DBE7A';
  if (n === 2) return '#EF4444';
  return '#94A3B8';
};

const avgColor = (v: number | string | null): string => {
  if (v === null || v === undefined) return '#94A3B8';
  const n = Number(v);
  if (n === 1.0) return '#3DBE7A';
  return '#F59E0B';
};

const flapsColor = (count: number): string =>
  count === 0 ? '#3DBE7A' : '#F59E0B';

// ─── Expanded Panel ──────────────────────────────────────────────────────────

interface ExpandedSfpPanelProps {
  stat: SfpPortStat;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, SfpHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, SfpHistoryPoint[]>>>;
}

const ExpandedSfpPanel: React.FC<ExpandedSfpPanelProps> = ({
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

  // Load available periods on first open
  useEffect(() => {
    if (!availablePeriodsCache[itemid]) {
      getSfpAvailablePeriods(itemid)
        .then((periods) => {
          setAvailablePeriodsCache((prev) => ({ ...prev, [itemid]: periods }));
        })
        .catch((err) => console.error('Failed to load SFP periods', err));
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
      return { key: `sfp-${itemid}-preset-${activePreset}`, from, to };
    } else if (selectedYear && selectedMonth) {
      const from = Math.floor(new Date(selectedYear, selectedMonth - 1, 1).getTime() / 1000);
      const to = Math.floor(new Date(selectedYear, selectedMonth, 1).getTime() / 1000) - 1;
      return { key: `sfp-${itemid}-custom-${selectedYear}-${selectedMonth}`, from, to };
    }
    return null;
  }, [itemid, activePreset, selectedYear, selectedMonth]);

  // Fetch history when selection changes
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

    getSfpPortHistory(itemid, from, to)
      .then((history) => {
        if (isMounted) {
          setCustomHistoryCache((prev) => ({ ...prev, [key]: history }));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load SFP history', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentSelectionParams, customHistoryCache, setCustomHistoryCache, itemid]);

  let currentHistory: SfpHistoryPoint[] = [];
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
    const validMonths = periods.filter((p) => p.year === year).map((p) => p.month);
    setSelectedMonth(validMonths.length > 0 ? Math.max(...validMonths) : null);
    setActivePreset(null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value));
    setActivePreset(null);
  };

  // Chart setup — line chart, Y axis 0-2
  const chartData = currentHistory.map((pt) => ({
    x: pt.day,
    y: pt.last_value !== null ? Number(pt.last_value) : null,
    avg_value: Number(pt.avg_value),
    min_value: Number(pt.min_value),
    max_value: Number(pt.max_value),
  }));

  const hasDown = chartData.some((d) => d.y === 2);
  const lineColor = hasDown ? '#F59E0B' : '#3DBE7A';

  // Point annotations for "Down" (value = 2)
  const pointAnnotations = chartData
    .filter((d) => d.y === 2)
    .map((d) => ({
      x: new Date(d.x).getTime(),
      y: 2,
      marker: {
        size: 6,
        fillColor: '#EF4444',
        strokeColor: '#fff',
        strokeWidth: 2,
        radius: 3,
      },
      label: {
        borderColor: '#EF4444',
        style: { color: '#fff', background: '#EF4444', fontSize: '10px' },
        text: 'Down',
        offsetY: -10,
      },
    }));

  const chartOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
      zoom: { enabled: false },
    },
    colors: [lineColor],
    fill: {
      type: 'solid',
      opacity: 0.15,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
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
      labels: {
        formatter: function (value) {
          const d = new Date(Number(value));
          return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
        },
        style: { colors: '#94A3B8', fontSize: '11px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 2,
      tickAmount: 2,
      labels: {
        formatter: (val: number) => {
          if (val === 0) return '—';
          if (val === 1) return 'Up';
          if (val === 2) return 'Down';
          return '';
        },
        style: { colors: '#94A3B8', fontSize: '11px' },
      },
    },
    annotations: {
      points: pointAnnotations,
    },
    tooltip: {
      custom: function ({ seriesIndex, dataPointIndex, w }: any) {
        const d = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const date = new Date(d.x);
        const dayStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const statusStr = d.y === 1 ? 'Up' : d.y === 2 ? 'Down' : '—';
        const statusColor = d.y === 1 ? '#3DBE7A' : '#EF4444';
        return `
          <div class="px-3 py-2 bg-white shadow-lg rounded border border-[#E2E8F0] text-[12px] text-[#0F172A]">
            <div class="font-bold mb-1">${dayStr}</div>
            <div>
              <span class="font-semibold text-[#64748B]">Status: </span>
              <span style="color:${statusColor};font-weight:600">${statusStr}</span>
            </div>
            <div><span class="font-semibold text-[#64748B]">Avg: </span>${Number(d.avg_value).toFixed(4)}</div>
          </div>
        `;
      },
    },
  };

  const series = [{ name: 'Status', data: chartData.map((d) => ({ x: new Date(d.x).getTime(), y: d.y, avg_value: d.avg_value })) }];

  const periodLabel = activePreset
    ? `Last ${activePreset} days`
    : selectedYear && selectedMonth
    ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
    : 'Custom range';

  const portNum = stat.port_number;
  const downCount = Number(stat.down_count);
  const lastValue = stat.last_value !== null ? Number(stat.last_value) : null;
  const minValue = stat.min_value !== null ? Number(stat.min_value) : null;
  const avgValue = stat.avg_value !== null ? Number(stat.avg_value) : null;
  const maxValue = stat.max_value !== null ? Number(stat.max_value) : null;

  const currentStatusLabel = lastValue === 1 ? 'Up' : lastValue === 2 ? 'Down' : '—';
  const currentStatusDot = lastValue === 1 ? '#3DBE7A' : '#EF4444';

  let interpretationBullet1 = `• Port SFP ${portNum} ${currentStatusLabel} (${lastValue}) avec last/min/avg/max = ${lastValue ?? '—'} / ${minValue ?? '—'} / ${avgValue !== null ? Number(avgValue).toFixed(4) : '—'} / ${maxValue ?? '—'}.`;
  let interpretationBullet2 = '';
  if (downCount === 0) {
    interpretationBullet2 = '• Conclusion : liaison stable sur la période.';
  } else {
    interpretationBullet2 = `• Conclusion : ${downCount} flap(s) détecté(s) — vérifier la fibre.`;
  }

  return (
    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-5 px-6 flex flex-col gap-6 overflow-hidden transition-all duration-300">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left side — Stats summary (30%) */}
        <div className="w-full md:w-[30%] flex flex-col gap-3">
          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Current status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatusDot }} />
              <span className="text-[14px] font-semibold text-[#0F172A]">{currentStatusLabel}</span>
            </div>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Last value</span>
            <span className="text-[14px] font-bold" style={{ color: valueColor(lastValue) }}>
              {lastValue !== null ? `${lastValue} (${currentStatusLabel})` : '—'}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Min (30d)</span>
            <span className="text-[14px] font-bold" style={{ color: valueColor(minValue) }}>
              {minValue !== null ? `${minValue} (${valueLabel(minValue)})` : '—'}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Avg (30d)</span>
            <span className="text-[14px] font-bold" style={{ color: avgColor(avgValue) }}>
              {avgValue !== null ? Number(avgValue).toFixed(4) : '—'}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Max (30d)</span>
            <span className="text-[14px] font-bold" style={{ color: valueColor(maxValue) }}>
              {maxValue !== null ? `${maxValue} (${valueLabel(maxValue)})` : '—'}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Flap count (30d)</span>
            <span className="text-[14px] font-bold" style={{ color: flapsColor(downCount) }}>
              {downCount}
            </span>
          </div>

          <div className="flex flex-col border-b border-[#E2E8F0] pb-3">
            <span className="text-[#94A3B8] text-[12px] mb-1">Last down</span>
            <span
              className="text-[14px] font-bold"
              style={{ color: stat.last_down ? '#0F172A' : '#3DBE7A' }}
            >
              {formatLastDown(stat.last_down)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[#94A3B8] text-[12px] mb-1">Monitoring period</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{periodLabel}</span>
          </div>
        </div>

        {/* Right side — Chart (70%) */}
        <div className="w-full md:w-[70%] flex flex-col">
          {/* Header + Time Selector */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4">
            <div>
              <h4 className="text-[14px] font-semibold text-[#0F172A] mb-0.5">
                Port {portNum} — Status History
              </h4>
              <p className="text-[12px] text-[#94A3B8]">
                1 = Up · 2 = Down · Flat green line = perfectly stable
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-[#F1F5F9] rounded-lg p-1">
                  {[7, 15, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => handlePresetClick(days)}
                      className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                        activePreset === days
                          ? 'bg-[#6B8FD4] text-white shadow-sm'
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
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6B8FD4] cursor-pointer"
                    value={selectedYear || ''}
                    onChange={handleYearChange}
                  >
                    <option value="" disabled>Year</option>
                    {years.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>

                  <select
                    className="bg-white border border-[#E2E8F0] text-[#0F172A] text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6B8FD4] cursor-pointer"
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

              <span className="text-[11px] font-medium text-[#6B8FD4] bg-[rgba(107,143,212,0.1)] px-2 py-0.5 rounded-full">
                {activePreset
                  ? `Showing last ${activePreset} days from today`
                  : selectedYear && selectedMonth
                  ? `Showing: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                  : 'Custom range'}
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
              <Chart options={chartOptions} series={series} type="area" width="100%" height="100%" />
            )}
          </div>

          {/* Interpretation panel — below chart */}
          <div
            className="mt-4 p-4 rounded-md border text-[13px] text-[#475569]"
            style={{
              borderLeft: '4px solid #6B8FD4',
              backgroundColor: '#F8FAFC',
              borderColor: '#E2E8F0',
              borderLeftColor: '#6B8FD4',
            }}
          >
            <div className="text-[13px] font-semibold text-[#0F172A] mb-2">KPI Interpretation</div>
            <div className="space-y-1">
              <p>{interpretationBullet1}</p>
              <p>{interpretationBullet2}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SFP Port Card ────────────────────────────────────────────────────────────

interface SfpPortCardProps {
  stat: SfpPortStat;
  isExpanded: boolean;
  onToggle: () => void;
  availablePeriodsCache: Record<number, AvailablePeriod[]>;
  customHistoryCache: Record<string, SfpHistoryPoint[]>;
  setAvailablePeriodsCache: React.Dispatch<React.SetStateAction<Record<number, AvailablePeriod[]>>>;
  setCustomHistoryCache: React.Dispatch<React.SetStateAction<Record<string, SfpHistoryPoint[]>>>;
}

const SfpPortCard: React.FC<SfpPortCardProps> = ({
  stat,
  isExpanded,
  onToggle,
  availablePeriodsCache,
  customHistoryCache,
  setAvailablePeriodsCache,
  setCustomHistoryCache,
}) => {
  const lastValue = stat.last_value !== null ? Number(stat.last_value) : null;
  const minValue = stat.min_value !== null ? Number(stat.min_value) : null;
  const avgValue = stat.avg_value !== null ? Number(stat.avg_value) : null;
  const maxValue = stat.max_value !== null ? Number(stat.max_value) : null;
  const downCount = Number(stat.down_count);
  const portNum = stat.port_number;

  // Status pill logic
  const getStatusPill = () => {
    if (lastValue === 1 && downCount === 0) {
      return { label: '🟢 Stable', bg: '#F0FDF4', color: '#15803d' };
    } else if (lastValue === 1 && downCount > 0) {
      return { label: '🟡 Recovered', bg: '#FFFBEB', color: '#B45309' };
    } else {
      return { label: '🔴 Down', bg: '#FEF2F2', color: '#DC2626' };
    }
  };

  const pill = getStatusPill();

  // Conclusion text
  const conclusionText =
    lastValue === 1 && downCount === 0
      ? '✅ Liaison stable — aucune coupure détectée sur la période.'
      : downCount > 0
      ? `⚠️ ${downCount} interruption(s) détectée(s) — dernière: ${formatLastDown(stat.last_down)}`
      : '';

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-sm flex flex-col">
      {/* Header (clickable) */}
      <div
        className="p-5 cursor-pointer hover:bg-[#FAFBFF] transition-colors duration-150 border-l-[4px]"
        style={{ borderLeftColor: '#6B8FD4' }}
        onClick={onToggle}
      >
        {/* Top row: name + status pill + chevron */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#0F172A]">SFP Port {portNum}</h3>
            <p className="text-[13px] text-[#94A3B8]">SW-1 Fibre Uplink</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              {pill.label}
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

        {/* Stats row — 5 boxes */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Last */}
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[64px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Last</span>
            <span className="text-[13px] font-bold" style={{ color: valueColor(lastValue) }}>
              {valueLabel(lastValue)}
            </span>
          </div>
          {/* Min */}
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[64px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Min</span>
            <span className="text-[13px] font-bold" style={{ color: valueColor(minValue) }}>
              {valueLabel(minValue)}
            </span>
          </div>
          {/* Avg */}
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[64px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Avg</span>
            <span className="text-[13px] font-bold" style={{ color: avgColor(avgValue) }}>
              {avgValue !== null ? Number(avgValue).toFixed(4) : '—'}
            </span>
          </div>
          {/* Max */}
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[64px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Max</span>
            <span className="text-[13px] font-bold" style={{ color: '#3DBE7A' }}>
              {valueLabel(maxValue)}
            </span>
          </div>
          {/* Flaps */}
          <div className="flex flex-col px-3 py-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] min-w-[64px]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-semibold mb-0.5">Flaps</span>
            <span className="text-[13px] font-bold" style={{ color: flapsColor(downCount) }}>
              {downCount}
            </span>
          </div>
        </div>

        {/* Conclusion text */}
        {conclusionText && (
          <p className="text-[13px] italic" style={{ color: '#475569' }}>
            {conclusionText}
          </p>
        )}
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <ExpandedSfpPanel
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

interface SfpPortsSectionProps {
  data: SfpPortStat[];
}

const SfpPortsSection: React.FC<SfpPortsSectionProps> = ({ data }) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [availablePeriodsCache, setAvailablePeriodsCache] = useState<Record<number, AvailablePeriod[]>>({});
  const [customHistoryCache, setCustomHistoryCache] = useState<Record<string, SfpHistoryPoint[]>>({});

  if (!data || data.length === 0) return null;

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="mb-4">
        <h3 className="text-[16px] font-semibold text-[#0F172A]">SW-1 — SFP Uplink Ports</h3>
        <p className="text-[13px] text-[#94A3B8] mt-0.5">
          Ports 49 · 50 · 51 — Fibre uplink monitoring
        </p>
      </div>

      {/* 3 cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-300">
        {data.map((stat) => {
          const isExpanded = expandedItemId === stat.itemid;
          return (
            <div
              key={stat.itemid}
              className={`transition-all duration-300 ${isExpanded ? 'md:col-span-3' : 'md:col-span-1'}`}
            >
              <SfpPortCard
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

export default SfpPortsSection;
