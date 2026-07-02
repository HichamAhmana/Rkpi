import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, CheckCircle, XCircle, Clock, TrendingUp, AlertCircle, Filter, Calendar, Target, ShieldAlert } from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { BRAND } from '../styles/colors';
import {
  getGlpiKpiSummary,
  getGlpiTicketVolume,
  getGlpiTimeTrends,
} from '../services/api';
import type {
  GlpiKpiSummary,
  GlpiTicketVolume,
  GlpiTimeTrends,
} from '../services/api';
import { DashboardSkeleton } from '../components/SkeletonLoader';

const POLL_INTERVAL = 60_000; // 60 seconds

const AVAILABLE_MONTHS = ['all', '2026-02', '2026-03', '2026-04', '2026-05'];

const GlpiDashboard: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [ticketType, setTicketType] = useState<number | undefined>(undefined); // undefined = All, 1 = Incidents, 2 = Demandes

  // Data States
  const [kpiSummary, setKpiSummary] = useState<GlpiKpiSummary | null>(null);
  const [volumeData, setVolumeData] = useState<GlpiTicketVolume[]>([]);
  const [timeTrends, setTimeTrends] = useState<GlpiTimeTrends | null>(null);
  const [incidentTimeTrends, setIncidentTimeTrends] = useState<GlpiTimeTrends | null>(null);
  const [demandTimeTrends, setDemandTimeTrends] = useState<GlpiTimeTrends | null>(null);

  const isMountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnceRef.current) {
        setInitialLoading(true);
      }

      const [summary, volume, trends, incidentTrends, demandTrends] = await Promise.all([
        getGlpiKpiSummary(selectedMonth, ticketType),
        getGlpiTicketVolume(ticketType),
        getGlpiTimeTrends(ticketType),
        getGlpiTimeTrends(1), // Incident
        getGlpiTimeTrends(2), // Demand
      ]);

      if (isMountedRef.current) {
        setKpiSummary(summary);
        setVolumeData(volume);
        setTimeTrends(trends);
        setIncidentTimeTrends(incidentTrends);
        setDemandTimeTrends(demandTrends);
        setError(null);

        if (!hasLoadedOnceRef.current) {
          hasLoadedOnceRef.current = true;
          setInitialLoading(false);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching GLPI data:', err);
        if (!hasLoadedOnceRef.current) {
          setError('Failed to load GLPI dashboard data. Please try again later.');
          setInitialLoading(false);
        }
      }
    }
  }, [selectedMonth, ticketType]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);



  if (initialLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !kpiSummary || !timeTrends || !incidentTimeTrends || !demandTimeTrends) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div
          className="bg-white rounded-xl border border-[#E2E8F0] p-10 flex flex-col items-center max-w-md text-center shadow-sm"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <ShieldAlert className="w-7 h-7 text-[#EF4444]" />
          </div>
          <h2 className="text-[18px] font-semibold text-[#0F172A] mb-2">Unable to Load GLPI Data</h2>
          <p className="text-[14px] text-[#94A3B8] mb-6">{error || 'Incomplete data received.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-white transition-colors"
            style={{ backgroundColor: '#2B5BA8' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Helper for French month formatting
  const formatMonthFr = (val: string) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length !== 2) return val;
    const [year, month] = parts;
    const monthsFr: Record<string, string> = {
      '01': 'Janv.',
      '02': 'Févr.',
      '03': 'Mars',
      '04': 'Avril',
      '05': 'Mai',
      '06': 'Juin',
      '07': 'Juil.',
      '08': 'Août',
      '09': 'Sept.',
      '10': 'Oct.',
      '11': 'Nov.',
      '12': 'Déc.'
    };
    return `${monthsFr[month] || month} ${year}`;
  };

  // Volume Chart Options
  const volumeChartOptions: any = {
    chart: {
      type: 'bar',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: 'transparent',
      events: {
        dataPointSelection: (_event: any, _chartContext: any, config?: any) => {
          const idx = config?.dataPointIndex;
          if (idx !== undefined && idx >= 0) {
            const clickedMonth = volumeData[idx]?.month;
            if (clickedMonth) {
              setSelectedMonth(clickedMonth);
            }
          }
        }
      }
    },
    plotOptions: {
      bar: {
        distributed: true,
        columnWidth: '35%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'top',
        },
      },
    },
    legend: {
      show: false,
    },
    colors: volumeData.map((d) => selectedMonth === 'all' || d.month === selectedMonth ? BRAND.mediumBlue : '#CBD5E1'),
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        shadeIntensity: 0.1,
        gradientToColors: volumeData.map((d) => selectedMonth === 'all' || d.month === selectedMonth ? BRAND.tealBlue : '#E2E8F0'),
        inverseColors: false,
        opacityFrom: 0.95,
        opacityTo: 0.85,
        stops: [0, 100],
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -22,
      style: {
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        colors: volumeData.map((d) => selectedMonth === 'all' || d.month === selectedMonth ? '#1E293B' : '#64748B'),
      },
      formatter: (val: any) => `${val}`,
    },
    xaxis: {
      categories: volumeData.map((d) => d.month),
      labels: {
        style: { colors: '#94A3B8', fontSize: '11px' },
        formatter: formatMonthFr,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      max: (max: number) => max + 5, // 5 tickets of headroom so label is never cut off
      labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      title: {
        text: 'Nombre de Tickets',
        style: { color: '#94A3B8', fontSize: '11px', fontWeight: 500 },
      },
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    states: {
      hover: {
        filter: {
          type: 'darken',
        }
      },
      active: {
        allowMultipleDataPointsSelection: false,
        filter: {
          type: 'none',
        }
      }
    },
    tooltip: {
      theme: 'light',
      custom: function({ series, seriesIndex, dataPointIndex }: any) {
        const monthStr = volumeData[dataPointIndex]?.month;
        const monthFormatted = formatMonthFr(monthStr);
        const val = series[seriesIndex][dataPointIndex];
        const isSelected = selectedMonth === 'all' || monthStr === selectedMonth;
        const dotColor = isSelected ? BRAND.mediumBlue : '#94A3B8';
        return `
          <div style="padding: 10px; background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); font-family: Inter, sans-serif;">
            <div style="font-size: 11px; color: #64748B; font-weight: 500; margin-bottom: 4px;">${monthFormatted}</div>
            <div style="font-size: 13px; font-weight: 600; color: #0F172A; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor};"></span>
              ${val} tickets
            </div>
            ${selectedMonth === 'all' 
              ? '<div style="font-size: 10px; color: #2B5BA8; font-weight: 600; margin-top: 6px;">● Inclus (Vue Globale)</div>' 
              : isSelected 
                ? '<div style="font-size: 10px; color: #2B5BA8; font-weight: 600; margin-top: 6px;">● Mois actif</div>' 
                : '<div style="font-size: 10px; color: #64748B; margin-top: 6px; font-style: italic;">Cliquer pour sélectionner</div>'}
          </div>
        `;
      }
    },
  };

  const volumeChartSeries = [
    {
      name: 'Tickets Créés',
      data: volumeData.map((d) => d.tickets),
    },
  ];

  // Time Trends Chart Options Helper
  const createTimeChartOptions = (trends: GlpiTimeTrends): ApexOptions => ({
    chart: {
      type: 'area',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: 'transparent',
    },
    colors: ['#F59E0B', BRAND.darkBlue],
    stroke: { curve: 'smooth', width: 2.5 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trends.timeToOwn.map((d) => d.month),
      labels: {
        style: { colors: '#94A3B8', fontSize: '11px' },
        formatter: formatMonthFr,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#94A3B8', fontSize: '11px' },
        formatter: (val) => `${val.toFixed(1)} h`,
      },
      title: {
        text: 'Heures',
        style: { color: '#94A3B8', fontSize: '11px', fontWeight: 500 },
      },
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#475569' },
      fontSize: '12px',
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0.02,
        stops: [0, 95, 100],
      },
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (val) => `${val.toFixed(1)} h` },
    },
  });

  const incidentChartSeries = [
    {
      name: 'Time to Own (Prise en Charge)',
      data: incidentTimeTrends.timeToOwn.map((d) => d.value),
    },
    {
      name: 'Time to Close (Clôture)',
      data: incidentTimeTrends.timeToClose.map((d) => d.value),
    },
  ];

  const demandChartSeries = [
    {
      name: 'Time to Own (Prise en Charge)',
      data: demandTimeTrends.timeToOwn.map((d) => d.value),
    },
    {
      name: 'Time to Close (Clôture)',
      data: demandTimeTrends.timeToClose.map((d) => d.value),
    },
  ];

  const getMonthNameFr = (monthStr: string) => {
    const monthsFr: Record<string, string> = {
      'all': 'Global (Tous les mois)',
      '2026-02': 'Février',
      '2026-03': 'Mars',
      '2026-04': 'Avril',
      '2026-05': 'Mai',
    };
    return monthsFr[monthStr] || monthStr;
  };

  // Calculating monthly volume change dynamically
  const getVolumeComparison = () => {
    const currentIndex = volumeData.findIndex((d) => d.month === selectedMonth);
    if (currentIndex <= 0) return null;
    const prevMonthData = volumeData[currentIndex - 1];
    const currentMonthData = volumeData[currentIndex];
    if (prevMonthData && currentMonthData) {
      const diff = prevMonthData.tickets - currentMonthData.tickets;
      const pctChange = prevMonthData.tickets > 0 ? (diff / prevMonthData.tickets) * 100 : 0;
      return {
        prevMonthName: getMonthNameFr(prevMonthData.month),
        prevTickets: prevMonthData.tickets,
        currentTickets: currentMonthData.tickets,
        pctChange: parseFloat(pctChange.toFixed(1)),
        isDecrease: pctChange > 0,
        isIncrease: pctChange < 0,
      };
    }
    return null;
  };

  const volComp = getVolumeComparison();

  // Calculating response time improvement dynamically
  const getOwnComparison = () => {
    const currentIndex = timeTrends.timeToOwn.findIndex((d) => d.month === selectedMonth);
    if (currentIndex <= 0) return null;
    const prevOwn = timeTrends.timeToOwn[currentIndex - 1]?.value;
    const currentOwn = timeTrends.timeToOwn[currentIndex]?.value;
    if (prevOwn !== undefined && currentOwn !== undefined) {
      const diff = prevOwn - currentOwn;
      const pctChange = prevOwn > 0 ? (diff / prevOwn) * 100 : 0;
      return {
        prevMonthName: getMonthNameFr(timeTrends.timeToOwn[currentIndex - 1].month),
        prevOwn: parseFloat(prevOwn.toFixed(1)),
        currentOwn: parseFloat(currentOwn.toFixed(1)),
        pctChange: parseFloat(pctChange.toFixed(1)),
        isImprovement: pctChange > 0,
        isRegression: pctChange < 0,
      };
    }
    return null;
  };

  const ownComp = getOwnComparison();

  // Calculating resolution time improvement dynamically
  const getCloseComparison = () => {
    const currentIndex = timeTrends.timeToClose.findIndex((d) => d.month === selectedMonth);
    if (currentIndex <= 0) return null;
    const prevClose = timeTrends.timeToClose[currentIndex - 1]?.value;
    const currentClose = timeTrends.timeToClose[currentIndex]?.value;
    if (prevClose !== undefined && currentClose !== undefined) {
      const diff = prevClose - currentClose;
      const pctChange = prevClose > 0 ? (diff / prevClose) * 100 : 0;
      return {
        prevMonthName: getMonthNameFr(timeTrends.timeToClose[currentIndex - 1].month),
        prevClose: parseFloat(prevClose.toFixed(1)),
        currentClose: parseFloat(currentClose.toFixed(1)),
        pctChange: parseFloat(pctChange.toFixed(1)),
        isImprovement: pctChange > 0,
        isRegression: pctChange < 0,
      };
    }
    return null;
  };

  const closeComp = getCloseComparison();

  return (
    <div className="space-y-8">
      {/* Filtering Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-2 text-[#475569] font-medium text-[14px]">
          <Filter className="w-4 h-4 text-[#2B5BA8]" />
          <span>Filtres Tableau de Bord :</span>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {/* Month Selector */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-[#64748B] mr-2 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-[13px] text-[#334155] font-semibold focus:outline-none cursor-pointer w-full"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m === '2026-04' ? 'Avril 2026 (Focus)' : m === '2026-03' ? 'Mars 2026' : m === '2026-02' ? 'Février 2026' : m === '2026-05' ? 'Mai 2026' : m}
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 w-full sm:w-auto">
            <Target className="w-4 h-4 text-[#64748B] mr-2 shrink-0" />
            <select
              value={ticketType === undefined ? 'all' : ticketType.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setTicketType(val === 'all' ? undefined : parseInt(val, 10));
              }}
              className="bg-transparent text-[13px] text-[#334155] font-semibold focus:outline-none cursor-pointer w-full"
            >
              <option value="all">Tous les tickets (Global)</option>
              <option value="1">Incidents Techniques</option>
              <option value="2">Demandes de Service</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Synthèse Section */}
      <div className="space-y-4">
        {/* Row 1: Volume KPIs — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tickets Créés */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 group hover:-translate-y-0.5 transition-all duration-300"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#2B5BA8]" />
            <div className="flex items-start justify-between mb-4">
              <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Tickets Créés</p>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-blue-100 bg-blue-50/60">
                <FileText className="w-[18px] h-[18px] text-[#2B5BA8]" />
              </div>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none mb-2">
              {kpiSummary.ticketsCreated}
            </div>
            <p className="text-[12px] text-slate-400">
              {selectedMonth === '2026-04' && ticketType === undefined
                ? 'Activité modérée après le pic de mars'
                : 'Nombre de tickets ouverts sur la période'}
            </p>
          </div>

          {/* Tickets Résolus / Clos */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 group hover:-translate-y-0.5 transition-all duration-300"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3DBE7A]" />
            <div className="flex items-start justify-between mb-4">
              <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Tickets Clos</p>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-100 bg-emerald-50/60">
                <CheckCircle className="w-[18px] h-[18px] text-[#3DBE7A]" />
              </div>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none mb-2">
              {kpiSummary.ticketsClosed}
            </div>
            <p className="text-[12px] text-slate-400">Total clôturés sur la période sélectionnée</p>
          </div>

          {/* Taux de Résolution */}
          {(() => {
            const targetMet = kpiSummary.resolutionRate >= 90;
            const accent = targetMet ? '#3DBE7A' : '#EF4444';
            const bgTint = targetMet ? 'rgba(61,190,122,0.06)' : 'rgba(239,68,68,0.06)';
            const borderTint = targetMet ? 'border-emerald-100' : 'border-red-100';
            const iconBg = targetMet ? 'bg-emerald-50/60' : 'bg-red-50/60';
            return (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 group hover:-translate-y-0.5 transition-all duration-300"
                   style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: accent }} />
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Taux de Résolution</p>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${borderTint} ${iconBg}`}>
                    <TrendingUp className="w-[18px] h-[18px]" style={{ color: accent }} />
                  </div>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
                    {kpiSummary.resolutionRate.toFixed(1)}%
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1"
                        style={{ backgroundColor: bgTint, borderColor: accent + '25', color: accent }}>
                    {targetMet ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {targetMet ? 'Cible 90% atteinte' : 'Sous la cible 90%'}
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                       style={{ width: `${Math.min(kpiSummary.resolutionRate, 100)}%`, backgroundColor: accent }} />
                </div>
                <p className="text-[12px] text-slate-400 mt-2">
                  Calcul : {kpiSummary.ticketsClosed} tickets clos ÷ {kpiSummary.ticketsCreated} tickets créés × 100
                </p>
              </div>
            );
          })()}
        </div>

        {/* Row 2: Time KPIs — 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time to Own */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 group hover:-translate-y-0.5 transition-all duration-300"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#F59E0B]" />
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-3">Time to Own — Prise en Charge</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
                    {kpiSummary.timeToOwn.toFixed(1)}
                  </span>
                  <span className="text-[16px] font-semibold text-slate-400">heures</span>
                </div>
                <p className="text-[12px] text-slate-400 mt-1">
                  {selectedMonth === '2026-04' && ticketType === undefined
                    ? 'Prise en charge en ~0,5 journée ouvrée'
                    : 'Délai moyen de prise en charge'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Calcul : moyenne (date de prise en charge − date de création)
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-amber-100 bg-amber-50/60 shrink-0 ml-4">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </div>

          {/* Time to Close */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 group hover:-translate-y-0.5 transition-all duration-300"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#E24A8D]" />
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-3">Time to Close — Résolution</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
                    {kpiSummary.timeToClose.toFixed(1)}
                  </span>
                  <span className="text-[16px] font-semibold text-slate-400">heures</span>
                </div>
                <p className="text-[12px] text-slate-400 mt-1">
                  {selectedMonth === '2026-04' && ticketType === undefined
                    ? 'Valeur la plus élevée sur la période affichée'
                    : 'Délai moyen de clôture des tickets'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Calcul : moyenne (date de résolution − date de création)
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-pink-100 bg-pink-50/60 shrink-0 ml-4">
                <Clock className="w-6 h-6 text-[#E24A8D]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Context Banner for Incidents vs Requests */}
      <div className="p-4 rounded-xl border border-blue-100 bg-[#F0F7FF] flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#2B5BA8] shrink-0 mt-0.5" />
        <div className="text-[13px] text-[#1E3A8A]">
          <span className="font-bold">Analyse Micro-UX : </span>
          Ce KPI global est influencé principalement par les demandes de service longues (validations, approvisionnements). 
          Cela ne signifie pas que le support est lent sur les incidents critiques. 
          {ticketType === undefined && (
            <span> Utilisez le filtre <strong className="underline">"Incidents Techniques"</strong> dans le menu ci-dessus pour observer les temps de traitement réels sur les incidents (<strong className="font-semibold">Time to Close ~1.4 h</strong>).</span>
          )}
          {ticketType === 1 && (
            <span> Filtre actif : <strong className="font-semibold">Incidents Techniques</strong>. Le support affiche une excellente rapidité : réaction en <strong className="font-semibold">~1.2 h</strong> et résolution complète en <strong className="font-semibold">~1.4 h</strong> (délai &lt; 2h).</span>
          )}
          {ticketType === 2 && (
            <span> Filtre actif : <strong className="font-semibold">Demandes de Service</strong>. Workflow normal étalé dans le temps (prise en charge en <strong className="font-semibold">~18.3 h</strong>, clôture moyenne sous <strong className="font-semibold">54.9 h</strong> due aux processus administratifs).</span>
          )}
        </div>
      </div>

      {/* Ticket Volume Chart - Full Width */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Volumétrie des Tickets par Mois</h3>
        <p className="text-[13px] text-[#94A3B8] mb-4">Volume mensuel de création de tickets</p>
        <div className="h-72">
          <Chart options={volumeChartOptions} series={volumeChartSeries} type="bar" height="100%" />
        </div>
      </div>

      {/* Time Trends Grid - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Trends Chart - Incidents */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Évolution des Délais Moyens — Incidents</h3>
          <p className="text-[13px] text-[#94A3B8] mb-4">Temps moyen de prise en charge et de clôture (heures)</p>
          <div className="h-72">
            <Chart options={createTimeChartOptions(incidentTimeTrends)} series={incidentChartSeries} type="area" height="100%" />
          </div>
        </div>

        {/* Time Trends Chart - Demandes */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Évolution des Délais Moyens — Demandes</h3>
          <p className="text-[13px] text-[#94A3B8] mb-4">Temps moyen de prise en charge et de clôture (heures)</p>
          <div className="h-72">
            <Chart options={createTimeChartOptions(demandTimeTrends)} series={demandChartSeries} type="area" height="100%" />
          </div>
        </div>
      </div>

      {/* Detailed Performance Analysis Cards */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-[16px] font-semibold text-[#0F172A]">Rapport d'Analyse de Performance</h3>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Analyse comparative approfondie basée sur les filtres actifs de la période.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-[#F1F5F9] pt-6">
          {/* Volumetrics analysis */}
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-slate-100/80 flex flex-col justify-between hover:border-[#2B5BA8]/20 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 text-[#2B5BA8]">
                  <TrendingUp className="w-[18px] h-[18px]" />
                </div>
                <h4 className="text-[14px] font-bold text-[#0F172A]">1. Volume des Tickets</h4>
              </div>

              <div className="text-[13px] text-[#475569] space-y-3 leading-relaxed">
                {volComp ? (
                  <p>
                    Le nombre de tickets est passé de <strong className="text-[#0F172A]">{volComp.prevTickets} en {volComp.prevMonthName}</strong> à{' '}
                    <strong className="text-[#0F172A]">{volComp.currentTickets} en {getMonthNameFr(selectedMonth)}</strong>.
                  </p>
                ) : (
                  <p>
                    Le nombre de tickets créés est de <strong className="text-[#0F172A]">{kpiSummary.ticketsCreated}</strong> pour le mois de <strong className="text-[#0F172A]">{getMonthNameFr(selectedMonth)}</strong>.
                  </p>
                )}

                {volComp && (
                  <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                    volComp.isDecrease ? 'bg-emerald-50 text-[#059669] border border-emerald-100' : 'bg-red-50 text-[#DC2626] border border-red-100'
                  }`}>
                    {volComp.isDecrease ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {volComp.isDecrease
                      ? `Réduction de ~${volComp.pctChange}% vs ${volComp.prevMonthName}`
                      : `Hausse de ~${Math.abs(volComp.pctChange)}% vs ${volComp.prevMonthName}`}
                  </div>
                )}

                {volComp && (
                  <p className="text-[11px] font-mono text-[#64748B] bg-white border border-slate-100 rounded-md px-2.5 py-1.5">
                    KPI : ({volComp.prevTickets} − {volComp.currentTickets}) ÷ {volComp.prevTickets} × 100 ≈ {volComp.pctChange}%
                  </p>
                )}
                
                <p className="text-[12px] italic text-[#64748B] bg-white border border-slate-100 p-2.5 rounded-lg">
                  {volComp && volComp.isDecrease 
                    ? "C'est une amélioration importante : moins d'incidents signalés, meilleure stabilité ou efficacité corrective."
                    : "Une augmentation du volume peut signaler une mise en production récente ou un problème récurrent sur l'infrastructure."}
                </p>
              </div>
            </div>
          </div>

          {/* Response time analysis */}
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-slate-100/80 flex flex-col justify-between hover:border-[#F59E0B]/20 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 text-[#F59E0B]">
                  <Clock className="w-[18px] h-[18px]" />
                </div>
                <h4 className="text-[14px] font-bold text-[#0F172A]">2. Temps de Prise en Charge</h4>
              </div>

              <div className="text-[13px] text-[#475569] space-y-3 leading-relaxed">
                <p>
                  <strong>Time to Own = {selectedMonth === '2026-04' ? '11.4 heures' : `${kpiSummary.timeToOwn.toFixed(1)} heures`}</strong> en moyenne.
                </p>
                <p>
                  Temps de réaction global très satisfaisant (~{(kpiSummary.timeToOwn / 24).toFixed(1)} j).
                </p>

                {ownComp && (
                  <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                    ownComp.isImprovement ? 'bg-emerald-50 text-[#059669] border border-emerald-100' : 'bg-amber-50 text-[#D97706] border border-amber-100'
                  }`}>
                    {ownComp.isImprovement ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {ownComp.isImprovement
                      ? `Prise en charge accélérée : -${ownComp.pctChange}% vs ${ownComp.prevMonthName}`
                      : `Temps de réaction allongé : +${Math.abs(ownComp.pctChange)}% vs ${ownComp.prevMonthName}`}
                  </div>
                )}

                {ownComp && (
                  <p className="text-[11px] font-mono text-[#64748B] bg-white border border-slate-100 rounded-md px-2.5 py-1.5">
                    KPI : ({ownComp.prevOwn} − {ownComp.currentOwn}) ÷ {ownComp.prevOwn} × 100 ≈ {ownComp.pctChange}%
                  </p>
                )}

                <p className="text-[12px] italic text-[#64748B] bg-white border border-slate-100 p-2.5 rounded-lg">
                  {kpiSummary.timeToOwn < 12 
                    ? "Délai très court assurant aux utilisateurs une prise en compte rapide de leurs demandes."
                    : "Les délais d'attribution peuvent être optimisés par une répartition des ressources plus dynamique."}
                </p>
              </div>
            </div>
          </div>

          {/* Resolution time analysis */}
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-slate-100/80 flex flex-col justify-between hover:border-[#E24A8D]/20 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-pink-50 text-[#E24A8D]">
                  <CheckCircle className="w-[18px] h-[18px]" />
                </div>
                <h4 className="text-[14px] font-bold text-[#0F172A]">3. Délais de Clôture</h4>
              </div>

              <div className="text-[13px] text-[#475569] space-y-3 leading-relaxed">
                <p>
                  <strong>Time to Close = {selectedMonth === '2026-04' ? '33.5 heures' : `${kpiSummary.timeToClose.toFixed(1)} heures`}</strong> en moyenne.
                </p>
                <p>
                  Écart moyen entre prise en charge et clôture : <strong className="text-[#0F172A]">{(kpiSummary.timeToClose - kpiSummary.timeToOwn).toFixed(1)} heures</strong>.
                </p>

                <p className="text-[11px] font-mono text-[#64748B] bg-white border border-slate-100 rounded-md px-2.5 py-1.5">
                  KPI : {kpiSummary.timeToClose.toFixed(1)} h − {kpiSummary.timeToOwn.toFixed(1)} h = {(kpiSummary.timeToClose - kpiSummary.timeToOwn).toFixed(1)} h
                </p>

                {closeComp && (
                  <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                    closeComp.isImprovement ? 'bg-emerald-50 text-[#059669] border border-emerald-100' : 'bg-amber-50 text-[#D97706] border border-amber-100'
                  }`}>
                    {closeComp.isImprovement ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {closeComp.isImprovement
                      ? `Résolution accélérée : -${closeComp.pctChange}% vs ${closeComp.prevMonthName}`
                      : `Résolution allongée : +${Math.abs(closeComp.pctChange)}% vs ${closeComp.prevMonthName}`}
                  </div>
                )}

                <p className="text-[12px] italic text-[#64748B] bg-white border border-slate-100 p-2.5 rounded-lg">
                  Le temps de clôture global est influencé principalement par les demandes de service longues (validations, approvisionnements). Les incidents critiques et techniques restent résolus sous 2h.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlpiDashboard;
