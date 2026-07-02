import React, { useEffect, useState, useRef } from 'react';
import {
  FileText, Mail, Download, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { BRAND } from '../styles/colors';
import logoImg from '../../assets/logo.png';
import {
  getServiceAvailability,
  getAgentAvailabilityStats,
  getUptimeStats,
  getSfpPortsStats,
  getSwitchUptimeStats,
  getGlpiKpiSummary,
  getGlpiTicketVolume,
  getGlpiTimeTrends,
  sendReportByEmail,
  getZabbixReportCharts,
} from '../services/api';
import type {
  ServerServices,
  AgentStat,
  UptimeStat,
  SfpPortStat,
  SwitchUptimeStat,
  GlpiKpiSummary,
  GlpiTicketVolume,
  GlpiTimeTrends,
  ZabbixReportCharts,
  ChartDayRaw,
  AgentChartDay,
} from '../services/api';

// ─── Gradient transparent→white pre-processor ─────────────────────────────────
// html2canvas renders `transparent` as opaque black inside gradients.
// This patches every inline background that contains `transparent` to use
// rgba(255,255,255,0) instead, then restores the originals after capture.
function fixGradientTransparents(root: HTMLElement): () => void {
  type Saved = { el: HTMLElement; prop: 'background' | 'backgroundImage'; was: string };
  const saved: Saved[] = [];
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].forEach(el => {
    (['background', 'backgroundImage'] as const).forEach(prop => {
      const val = el.style[prop];
      if (val && val.includes('transparent')) {
        saved.push({ el, prop, was: val });
        (el.style as unknown as Record<string, string>)[prop] = val.replace(/\btransparent\b/g, 'rgba(255,255,255,0)');
      }
    });
  });
  return () => saved.forEach(({ el, prop, was }) => { (el.style as unknown as Record<string, string>)[prop] = was; });
}

// ─── Oklab→RGB pre-processor ──────────────────────────────────────────────────
function convertOklabColors(root: HTMLElement): () => void {
  const off = document.createElement('canvas');
  off.width = off.height = 1;
  const ctx = off.getContext('2d', { willReadFrequently: true })!;
  const toRgb = (color: string): string | null => {
    if (!color || (!color.includes('oklab') && !color.includes('oklch') && !color.includes('color('))) return null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return a < 255 ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})` : `rgb(${r},${g},${b})`;
    } catch { return null; }
  };
  const PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'caretColor'] as const;
  type Saved = { el: HTMLElement; prop: string; was: string };
  const saved: Saved[] = [];
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].forEach(el => {
    const cs = window.getComputedStyle(el);
    PROPS.forEach(prop => {
      const val = cs[prop] as string;
      const rgb = toRgb(val);
      if (rgb) { saved.push({ el, prop, was: el.style[prop] ?? '' }); el.style[prop] = rgb; }
    });
  });
  return () => saved.forEach(({ el, prop, was }) => { (el.style as unknown as Record<string, string>)[prop] = was; });
}

// ─── Safe hex→rgba for PDF-safe inline styles (avoids 8-digit hex alpha) ──────
const hexRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Module-level date constants ───────────────────────────────────────────────
const _now = new Date();
const _ago30 = new Date(_now);
_ago30.setDate(_now.getDate() - 30);
const periodFrom = _ago30.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const periodTo = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatUptime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `${d}j ${h}h` : h > 0 ? `${h}h` : `${Math.floor((seconds % 3600) / 60)}m`;
};

const formatUptimeWeeks = (seconds: number): string => {
  if (!seconds || seconds < 0) return '—';
  return `${(seconds / (7 * 86400)).toFixed(2)} semaines`;
};

const formatMonthFr = (val: string): string => {
  if (!val) return '';
  const [year, month] = val.split('-');
  const names: Record<string, string> = {
    '01': 'Janv.', '02': 'Févr.', '03': 'Mars', '04': 'Avril',
    '05': 'Mai', '06': 'Juin', '07': 'Juil.', '08': 'Août',
    '09': 'Sept.', '10': 'Oct.', '11': 'Nov.', '12': 'Déc.',
  };
  return `${names[month] || month} ${year}`;
};

const formatMonthFrLong = (val: string): string => {
  if (!val) return '';
  const [year, month] = val.split('-');
  const names: Record<string, string> = {
    '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
    '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
    '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
  };
  return `${names[month] || month} ${year}`;
};

// ─── Table style constants (matching PDF's dark navy headers) ──────────────────
const NAVY = '#1B3A6B';
const THN = 'text-white text-left px-3 py-2.5 text-[11px] font-bold tracking-wide';
const TDR = 'px-3 py-2.5 text-[12px] text-[#334155] border border-[#E2E8F0]';
const TDB = 'px-3 py-2.5 text-[12px] font-semibold text-[#0F172A] border border-[#E2E8F0]';

// ─── Sub-components ────────────────────────────────────────────────────────────
const SectionDivider: React.FC<{ number?: string; title: string; subtitle: string }> = ({ number, title, subtitle }) => (
  <div className="mt-2 mb-5">
    <div
      className="flex items-center gap-3 mb-2 px-4 py-3 rounded-xl"
      style={{ background: `linear-gradient(90deg, rgba(27,58,107,0.05) 0%, rgba(58,157,191,0.024) 60%, rgba(58,157,191,0) 100%)`, borderLeft: `3px solid ${NAVY}` }}
    >
      {number && (
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold text-white shrink-0"
          style={{ backgroundColor: NAVY }}
        >
          {number.replace(')', '')}
        </span>
      )}
      <h2 className="text-[15px] font-bold text-[#0F172A] tracking-tight">{title}</h2>
    </div>
    <p className="text-[11px] text-[#64748B] italic mb-2 px-1">{subtitle}</p>
    <div className="h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BRAND.tealBlue} 55%, rgba(58,157,191,0) 100%)` }} />
  </div>
);

const SubTitle: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2.5 mt-6 mb-2.5">
    <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: BRAND.tealBlue }} />
    <p className="text-[11px] font-bold text-[#0F172A] uppercase tracking-widest">{text}</p>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const PdfReport: React.FC = () => {
  const reportRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [serviceData, setServiceData] = useState<ServerServices[]>([]);
  const [agentData, setAgentData] = useState<AgentStat[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimeStat[]>([]);
  const [sfpData, setSfpData] = useState<SfpPortStat[]>([]);
  const [switchData, setSwitchData] = useState<SwitchUptimeStat[]>([]);
  const [glpiKpi, setGlpiKpi] = useState<GlpiKpiSummary | null>(null);
  const [glpiVolume, setGlpiVolume] = useState<GlpiTicketVolume[]>([]);
  const [glpiIncidentTrends, setGlpiIncidentTrends] = useState<GlpiTimeTrends | null>(null);
  const [glpiDemandTrends, setGlpiDemandTrends] = useState<GlpiTimeTrends | null>(null);
  const [reportCharts, setReportCharts] = useState<ZabbixReportCharts | null>(null);
  // The month actually used for the KPI section (falls back to latest month with data)
  const [reportMonth, setReportMonth] = useState(currentMonth);

  useEffect(() => {
    (async () => {
      try {
        const [
          services, agents, uptimes, sfpPorts, switches,
          kpiInitial, volume, incidentTrends, demandTrends, charts,
        ] = await Promise.all([
          getServiceAvailability(),
          getAgentAvailabilityStats(),
          getUptimeStats(),
          getSfpPortsStats(),
          getSwitchUptimeStats(),
          getGlpiKpiSummary(currentMonth),
          getGlpiTicketVolume(),
          getGlpiTimeTrends(1),
          getGlpiTimeTrends(2),
          getZabbixReportCharts(),
        ]);

        // If current month has no tickets, fall back to the latest month that does
        const latestNonEmpty = [...volume]
          .filter(v => v.tickets > 0)
          .sort((a, b) => b.month.localeCompare(a.month))[0]?.month;

        let kpi = kpiInitial;
        if (kpiInitial.ticketsCreated === 0 && latestNonEmpty && latestNonEmpty !== currentMonth) {
          kpi = await getGlpiKpiSummary(latestNonEmpty);
          setReportMonth(latestNonEmpty);
        }

        setServiceData(services);
        setAgentData(agents);
        setUptimeData(uptimes);
        setSfpData(sfpPorts);
        setSwitchData(switches);
        setGlpiKpi(kpi);
        setGlpiVolume(volume);
        setGlpiIncidentTrends(incidentTrends);
        setGlpiDemandTrends(demandTrends);
        setReportCharts(charts);
      } catch (e) {
        console.error('PdfReport fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── PDF builder (smart page breaks — never cuts through a table row or heading) ──
  const buildPdf = async (): Promise<jsPDF | null> => {
    if (!reportRef.current) return null;
    const el = reportRef.current;

    // Let ApexCharts SVGs and fonts finish rendering before capture
    await new Promise(resolve => setTimeout(resolve, 800));

    // Force the element to A4 width so the captured canvas exactly matches A4
    // proportions with no leftover horizontal space. 794 px = A4 at 96 DPI.
    const CAPTURE_W = 794;
    const savedWidth = el.style.width;
    el.style.width = `${CAPTURE_W}px`;

    const restoreColors = convertOklabColors(el);
    const restoreGradients = fixGradientTransparents(el);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: CAPTURE_W,
        height: el.scrollHeight,
        windowWidth: CAPTURE_W,
      });

      const A4_W = 210;
      const A4_H = 297;
      const pxPerMm = canvas.width / A4_W;
      const pageH = Math.floor(A4_H * pxPerMm); // canvas pixels that fit one A4 page

      // ── Collect bounding boxes (canvas px) of every element that must not be cut ──
      // All elements regardless of height — tall cards (> pageH) are allowed to span
      // pages but are pushed to START at the top of a fresh page on the first hit.
      const rootRect = el.getBoundingClientRect();
      const sy = canvas.height / rootRect.height;
      const noSplit: { top: number; bottom: number }[] = [];
      el.querySelectorAll<HTMLElement>('tr, h2, h3, [data-pdf-card]').forEach(elem => {
        const r = elem.getBoundingClientRect();
        const top = (r.top - rootRect.top) * sy;
        const bottom = (r.bottom - rootRect.top) * sy;
        if (top < bottom) noSplit.push({ top, bottom });
      });

      // ── Determine where to break each page ───────────────────────────────────
      // For each natural break, scan ALL overlapping no-split elements and choose
      // the one with the SMALLEST top — that's the outermost/earliest element.
      // Pushing to its top guarantees the break lands outside every overlapping block.
      const pageBreaks: number[] = [];
      let nextBreak = pageH;
      while (nextBreak < canvas.height) {
        let bp = nextBreak;
        const prev = pageBreaks.length > 0 ? pageBreaks[pageBreaks.length - 1] : 0;

        let bestCandidate: number | null = null;
        for (const { top, bottom } of noSplit) {
          if (bp > top + 4 && bp < bottom - 4) {
            const candidate = top - 8; // just above this element
            // Reject candidates that would leave < 5 % of a page before the break
            if (candidate > prev + pageH * 0.05) {
              if (bestCandidate === null || candidate < bestCandidate) {
                bestCandidate = candidate;
              }
            }
          }
        }
        if (bestCandidate !== null) bp = bestCandidate;

        pageBreaks.push(bp);
        nextBreak = bp + pageH;
      }

      // ── Slice canvas and assemble PDF ─────────────────────────────────────────
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const sliceStarts = [0, ...pageBreaks];
      for (let i = 0; i < sliceStarts.length; i++) {
        const startPx = sliceStarts[i];
        const endPx = i + 1 < sliceStarts.length ? sliceStarts[i + 1] : canvas.height;
        const heightPx = endPx - startPx;
        const heightMm = heightPx / pxPerMm;
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = heightPx;
        const ctx = slice.getContext('2d')!;
        // Fill white before compositing — prevents black bands on the final short
        // page and on any rounding gaps where the source canvas doesn't reach.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, -startPx);
        if (i > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_W, heightMm);
      }
      return pdf;
    } finally {
      el.style.width = savedWidth;
      restoreColors();
      restoreGradients();
    }
  };

  const handleExport = async () => {
    setExporting(true); setExportStatus('idle');
    try {
      const pdf = await buildPdf();
      if (pdf) { pdf.save(`rapport-kpi-${_now.toISOString().slice(0, 10)}.pdf`); setExportStatus('success'); setTimeout(() => setExportStatus('idle'), 4000); }
    } catch (e) { console.error('PDF export failed:', e); setExportStatus('error'); setTimeout(() => setExportStatus('idle'), 4000); }
    finally { setExporting(false); }
  };

  const handleSendEmail = async () => {
    setSending(true); setEmailStatus('idle');
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      const filename = `rapport-kpi-${_now.toISOString().slice(0, 10)}.pdf`;
      const monthLabel = _now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const raw = pdf.output('datauristring');
      const pdfBase64 = (typeof raw === 'string' ? raw : '').split(',')[1] ?? '';
      await sendReportByEmail(pdfBase64, filename, monthLabel);
      setEmailStatus('success'); setTimeout(() => setEmailStatus('idle'), 4000);
    } catch (e) { console.error('Email send failed:', e); setEmailStatus('error'); setTimeout(() => setEmailStatus('idle'), 4000); }
    finally { setSending(false); }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND.darkBlue }} />
          <p className="text-[14px] text-[#64748B]">Chargement du rapport...</p>
        </div>
      </div>
    );
  }

  // ─── Derived / computed values ───────────────────────────────────────────────

  // Extract the human-readable service name from the Zabbix item name.
  // "State of service \"DNS\" (DNS Server)" → "DNS Server"
  // "State of service \"MSSQL$SAGE100\" (SQL Server (SAGE100))" → "SQL Server (SAGE100)"
  const cleanSvcName = (raw: string): string => {
    const paren = raw.match(/\((.+)\)\s*$/);
    if (paren) return paren[1];
    const quoted = raw.match(/"([^"]+)"/);
    if (quoted) return quoted[1];
    return raw;
  };

  // Service KPI rows (grouped by server: services → uptime → agent)
  const allServers = Array.from(new Set([
    ...serviceData.map(s => s.server_name),
    ...uptimeData.map(u => u.host),
    ...agentData.map(a => a.host),
  ]));

  // Global health stats (used on cover + synthèse)
  let globalRunning = 0, globalAnomaly = 0, globalStopped = 0;
  const totalServicesMonitored = serviceData.reduce((acc, s) => {
    s.services.forEach(svc => {
      if (String(svc.current_state) !== '0') globalStopped++;
      else if (svc.incident_days > 0) globalAnomaly++;
      else globalRunning++;
    });
    return acc + s.services.length;
  }, 0);
  const globalAvailPct = totalServicesMonitored > 0
    ? Math.round((globalRunning / totalServicesMonitored) * 100) : 0;
  const avgAgentAvail = agentData.length > 0
    ? agentData.reduce((s, a) => s + Number(a.availability_pct), 0) / agentData.length : 0;

  type KpiRow = { server: string; indicator: string; value: string; comment: string; ok: boolean };
  const serviceKpiRows: KpiRow[] = allServers.flatMap(srv => {
    const rows: KpiRow[] = [];
    const srvServices = serviceData.find(s => s.server_name === srv);
    srvServices?.services.forEach(svc => {
      const name = cleanSvcName(svc.service_name);
      const ok = svc.incident_days === 0;
      rows.push({
        server: srv,
        indicator: `Arrêts — ${name}`,
        value: ok ? '✓ 0 arrêt' : `${svc.incident_days} jour(s)`,
        ok,
        comment: ok
          ? 'Service opérationnel en continu sur 30 jours.'
          : `Service interrompu ${svc.incident_days} jour(s)${svc.last_incident ? ` — dernier : ${new Date(svc.last_incident).toLocaleDateString('fr-FR')}` : ''}.`,
      });
    });
    const u = uptimeData.find(x => x.host === srv);
    if (u) rows.push({
      server: srv,
      indicator: 'Redémarrages (Uptime)',
      value: u.restart_count === 0 ? '✓ 0 redémarrage' : `${u.restart_count} redém.`,
      ok: u.restart_count === 0,
      comment: u.restart_count === 0
        ? 'Aucun redémarrage visible sur 30 jours.'
        : `Chute de l'uptime détectée${u.last_restart_time ? ` vers le ${new Date(u.last_restart_time).toLocaleDateString('fr-FR')}` : ''}.`,
    });
    const a = agentData.find(x => x.host === srv);
    if (a) {
      const avail = Number(a.availability_pct);
      const ok = avail >= 99;
      rows.push({
        server: srv,
        indicator: 'Disponibilité agent Zabbix',
        value: `${avail.toFixed(2)}%`,
        ok,
        comment: avail >= 99.5
          ? 'Disponibilité quasi constante.'
          : avail >= 99
            ? 'Indisponibilité brève corrélée au redémarrage.'
            : 'Indisponibilité notable à investiguer.',
      });
    }
    return rows;
  });

  // Network KPI rows
  type NetRow = { equip: string; indicator: string; obs: string; comment: string };
  const networkKpiRows: NetRow[] = [
    ...switchData.map(sw => ({
      equip: sw.switch_name,
      indicator: 'Uptime (tableau switches)',
      obs: `Uptime ≥ ${formatUptimeWeeks(sw.current_uptime_seconds)}`,
      comment: sw.restart_count === 0
        ? 'Aucun redémarrage visible sur les 30 derniers jours.'
        : `${sw.restart_count} redémarrage(s) détecté(s).`,
    })),
    ...sfpData.map(p => {
      const last = p.last_value !== null ? Number(p.last_value) : null;
      const min  = p.min_value !== null ? Number(p.min_value) : null;
      const avg  = p.avg_value !== null ? Number(p.avg_value) : null;
      const max  = p.max_value !== null ? Number(p.max_value) : null;
      const down = Number(p.down_count);
      const stable = last === 1 && min === 1 && avg === 1 && max === 1;
      return {
        equip: p.port_name,
        indicator: 'Statut port SFP',
        obs: `last=${last ?? '?'} / min=${min ?? '?'} / avg=${avg !== null ? avg.toFixed(1) : '?'} / max=${max ?? '?'}`,
        comment: stable
          ? 'Liaison SFP stable, aucune coupure visible.'
          : down > 0
            ? `${down} coupure(s) sur la période.`
            : 'Port actif ; légère variation détectée.',
      };
    }),
  ];

  // GLPI performance analysis
  const sortedVol = [...glpiVolume].sort((a, b) => a.month.localeCompare(b.month));
  const lastVol = sortedVol.at(-1);
  const prevVol = sortedVol.at(-2);
  const volChangePct = lastVol && prevVol && prevVol.tickets > 0
    ? ((lastVol.tickets - prevVol.tickets) / prevVol.tickets) * 100
    : null;

  const incTtoOwn = glpiIncidentTrends?.timeToOwn ?? [];
  const curTto = incTtoOwn.at(-1)?.value;
  const prvTto = incTtoOwn.at(-2)?.value;
  const ttoChangePct = curTto !== undefined && prvTto !== undefined && prvTto !== 0
    ? ((curTto - prvTto) / prvTto) * 100
    : null;

  const incTtoClose = glpiIncidentTrends?.timeToClose ?? [];
  const curTtc = incTtoClose.at(-1)?.value;
  const prvTtc = incTtoClose.at(-2)?.value;
  const ttcChangePct = curTtc !== undefined && prvTtc !== undefined && prvTtc !== 0
    ? ((curTtc - prvTtc) / prvTtc) * 100
    : null;

  // Chart configs
  const volumeChartOpts: ApexOptions = {
    chart: { type: 'bar', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { columnWidth: '40%', borderRadius: 5, borderRadiusApplication: 'end' } },
    colors: [BRAND.mediumBlue],
    dataLabels: { enabled: true, offsetY: -20, style: { fontSize: '11px', colors: ['#1E293B'], fontWeight: '600', fontFamily: 'Inter, sans-serif' } },
    xaxis: {
      categories: glpiVolume.map(d => d.month),
      labels: { style: { colors: '#94A3B8', fontSize: '11px' }, formatter: formatMonthFr },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#94A3B8', fontSize: '11px' } } },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
    legend: { show: false },
    tooltip: { theme: 'light', y: { formatter: v => `${v} tickets` } },
  };

  const timeTrendsOpts = (trends: GlpiTimeTrends): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent' },
    colors: ['#F59E0B', BRAND.darkBlue],
    stroke: { curve: 'smooth', width: 2.5 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trends.timeToOwn.map(d => d.month),
      labels: { rotate: -30, style: { colors: '#94A3B8', fontSize: '10px' }, formatter: formatMonthFr },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#94A3B8', fontSize: '11px' }, formatter: v => `${v.toFixed(1)} h` } },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.01, stops: [0, 95, 100] } },
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#475569' }, fontSize: '12px' },
    tooltip: { theme: 'light', y: { formatter: v => `${v.toFixed(1)} h` } },
  });

  const incidentSeries = glpiIncidentTrends
    ? [
        { name: 'Time to Own', data: glpiIncidentTrends.timeToOwn.map(d => d.value) },
        { name: 'Time to Close', data: glpiIncidentTrends.timeToClose.map(d => d.value) },
      ]
    : [];

  const demandSeries = glpiDemandTrends
    ? [
        { name: 'Time to Own', data: glpiDemandTrends.timeToOwn.map(d => d.value) },
        { name: 'Time to Close', data: glpiDemandTrends.timeToClose.map(d => d.value) },
      ]
    : [];

  // ─── 30-day history chart helpers ────────────────────────────────────────────

  const dayLabel = (d: string) => d.slice(5); // "YYYY-MM-DD" → "MM-DD"

  const serviceChartOpts = (data: ChartDayRaw[], hasIncident: boolean): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    stroke: { curve: 'stepline', width: 1.5 },
    colors: [hasIncident ? '#F59E0B' : BRAND.green],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: hasIncident ? 0.35 : 0.22, opacityTo: 0.02, stops: [0, 100] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.map(d => dayLabel(d.day)),
      tickAmount: 6,
      labels: { style: { colors: '#94A3B8', fontSize: '9px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    // No y-axis labels for binary charts — the card header explains the scale
    yaxis: { min: 0, max: 1, labels: { show: false } },
    grid: { borderColor: '#EEF2F7', strokeDashArray: 5, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => v === 1 ? 'Service actif' : 'Incident' } },
  });

  const uptimeChartOpts = (data: ChartDayRaw[]): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    colors: [BRAND.darkBlue],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.18, opacityTo: 0.0, stops: [0, 90] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.map(d => dayLabel(d.day)),
      tickAmount: 5,
      labels: { style: { colors: '#B0BBCC', fontSize: '9px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { tickAmount: 2, labels: { style: { colors: '#B0BBCC', fontSize: '9px' }, formatter: (v: number) => `${Math.round(v / 86400)}j` } },
    grid: { borderColor: '#EEF2F7', strokeDashArray: 5, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => `${(v / 86400).toFixed(1)} jours` } },
  });

  const agentChartOpts = (data: AgentChartDay[]): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    colors: [BRAND.green],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.0, stops: [0, 90] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.map(d => dayLabel(d.day)),
      tickAmount: 5,
      labels: { style: { colors: '#B0BBCC', fontSize: '9px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { min: 0, max: 100, tickAmount: 2, labels: { style: { colors: '#B0BBCC', fontSize: '9px' }, formatter: (v: number) => `${v}%` } },
    grid: { borderColor: '#EEF2F7', strokeDashArray: 5, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => `${v.toFixed(1)}%` } },
  });

  const sfpChartOpts = (data: ChartDayRaw[], hasDown: boolean): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    stroke: { curve: 'stepline', width: 2 },
    colors: [hasDown ? '#EF4444' : BRAND.green],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: hasDown ? 0.25 : 0.15, opacityTo: 0.0, stops: [0, 90] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.map(d => dayLabel(d.day)),
      tickAmount: 5,
      labels: { style: { colors: '#B0BBCC', fontSize: '9px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { min: 0, max: 1, labels: { show: false } },
    grid: { borderColor: '#EEF2F7', strokeDashArray: 5, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => v === 1 ? 'UP — Lien actif' : 'DOWN — Coupure' } },
  });

  const switchChartOpts = (data: ChartDayRaw[]): ApexOptions => ({
    chart: { type: 'area', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    colors: [NAVY],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.14, opacityTo: 0.0, stops: [0, 90] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.map(d => dayLabel(d.day)),
      tickAmount: 5,
      labels: { style: { colors: '#B0BBCC', fontSize: '9px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { tickAmount: 2, labels: { style: { colors: '#B0BBCC', fontSize: '9px' }, formatter: (v: number) => `${(v / 604800).toFixed(1)}sem` } },
    grid: { borderColor: '#EEF2F7', strokeDashArray: 5, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => `${(v / 86400).toFixed(1)} jours` } },
  });

  const busy = exporting || sending;
  const todayStr = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ─── Row background helper ───────────────────────────────────────────────────
  const rowBg = (i: number) => i % 2 === 0 ? '#ffffff' : '#F8FAFC';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div
        className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-[#E2E8F0]"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAVY}12` }}>
            <FileText className="w-5 h-5" style={{ color: NAVY }} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#0F172A]">Rapport KPI — Disponibilité & Continuité</p>
            <p className="text-[12px] text-[#94A3B8]">Période : {periodFrom} → {periodTo} (30 derniers jours)</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExport} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-60 border"
            style={{
              color: exportStatus === 'success' ? '#059669' : exportStatus === 'error' ? '#DC2626' : 'white',
              borderColor: exportStatus === 'success' ? '#10B981' : exportStatus === 'error' ? '#EF4444' : 'transparent',
              backgroundColor: exportStatus === 'success' ? '#ECFDF5' : exportStatus === 'error' ? '#FEF2F2' : NAVY,
            }}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : exportStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : exportStatus === 'error' ? <AlertCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Génération...' : exportStatus === 'success' ? 'Téléchargé !' : exportStatus === 'error' ? 'Échec export' : 'Exporter PDF'}
          </button>
          <button
            onClick={handleSendEmail} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-60 border"
            style={{
              color: emailStatus === 'success' ? '#059669' : emailStatus === 'error' ? '#DC2626' : NAVY,
              borderColor: emailStatus === 'success' ? '#10B981' : emailStatus === 'error' ? '#EF4444' : `${NAVY}40`,
              backgroundColor: emailStatus === 'success' ? '#ECFDF5' : emailStatus === 'error' ? '#FEF2F2' : 'white',
            }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : emailStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : emailStatus === 'error' ? <AlertCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            {sending ? 'Envoi...' : emailStatus === 'success' ? 'Envoyé !' : emailStatus === 'error' ? 'Échec' : 'Envoyer par Email'}
          </button>
        </div>
      </div>

      {/* ── Report body (captured for PDF) ── */}
      <div ref={reportRef} className="bg-white p-8 space-y-10" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>

        {/* ════ COVER ════ */}
        <div className="pb-6">
          {/* Accent stripe */}
          <div className="h-1.5 rounded-full mb-5" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BRAND.tealBlue} 50%, ${BRAND.green} 100%)` }} />
          {/* Top bar: logo + date */}
          <div className="flex items-center justify-between pb-4 mb-5" style={{ borderBottom: `2px solid ${NAVY}` }}>
            <img src={logoImg} alt="Arwamedic" style={{ height: 34, objectFit: 'contain' }} />
            <div className="text-right">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">Rapport généré le</p>
              <p className="text-[12px] font-semibold text-[#334155]">{todayStr}</p>
            </div>
          </div>

          {/* Title block */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.tealBlue }}>
              Infrastructure IT / DSI
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, lineHeight: 1.15, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
              Rapport KPI — Disponibilité & Continuité
            </h1>
            <p className="text-[13px] text-[#475569] mb-4">
              Services applicatifs · Réseau · Plateforme Tickets
            </p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ backgroundColor: 'rgba(27,58,107,0.06)', color: NAVY }}
              >
                Période : {periodFrom} → {periodTo}
              </span>
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ backgroundColor: 'rgba(61,190,122,0.08)', color: BRAND.green }}
              >
                30 jours glissants
              </span>
            </div>
          </div>

          {/* Global KPI Strip */}
          {totalServicesMonitored > 0 && (
            <div className="mt-5 mb-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { value: allServers.length, label: 'Serveurs supervisés', color: NAVY },
                  { value: totalServicesMonitored, label: 'Services applicatifs', color: BRAND.tealBlue },
                  {
                    value: `${globalAvailPct}%`,
                    label: 'Services en ligne',
                    color: globalAvailPct >= 90 ? BRAND.green : '#D97706',
                  },
                  {
                    value: `${avgAgentAvail.toFixed(1)}%`,
                    label: 'Agent Zabbix (moy.)',
                    color: avgAgentAvail >= 99 ? BRAND.green : '#D97706',
                  },
                ].map(({ value, label, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4 text-center"
                    style={{ backgroundColor: hexRgba(color, 0.05), border: `1px solid ${hexRgba(color, 0.15)}` }}
                  >
                    <p className="text-[24px] font-extrabold" style={{ color, lineHeight: 1.2, margin: 0 }}>{value}</p>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider mt-2" style={{ color: '#64748B' }}>{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] mt-2.5 leading-relaxed" style={{ color: '#94A3B8' }}>
                Méthode de calcul — <strong>Services en ligne</strong> : services opérationnels sans incident sur 30 jours ({globalRunning}) ÷ services supervisés ({totalServicesMonitored}) × 100.{' '}
                <strong>Agent Zabbix (moy.)</strong> : moyenne des disponibilités par agent sur 30 jours (contrôles OK ÷ contrôles totaux × 100), chaque agent pesant à part égale.
              </p>
            </div>
          )}

          {/* TOC cards */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: 'rgba(27,58,107,0.02)', border: '1px solid rgba(27,58,107,0.09)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: NAVY }}>
              Sections du rapport
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { num: '1', title: 'Disponibilité Services', sub: 'Serveurs · Agents · Uptime' },
                { num: '2', title: 'Disponibilité Réseau',   sub: 'Switches · Ports SFP' },
                { num: '3', title: 'Tickets GLPI',           sub: 'KPI · Délais · Volumétrie' },
              ].map(({ num, title, sub }) => (
                <div key={num} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: NAVY }}
                  >
                    {num}
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-[#0F172A]">{title}</p>
                    <p className="text-[11px] text-[#94A3B8]">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#E2E8F0]">
              Sources : Zabbix (état de services, uptime, disponibilité agent, statut de ports) · GLPI (statistiques tickets, délais)
            </p>
          </div>
        </div>

        {/* ════ SECTION 1 — SERVICES ════ */}
        <div className="space-y-5">
          <SectionDivider
            number="1)"
            title="Disponibilité / Continuité des services"
            subtitle="Périmètre : serveurs applicatifs et d'infrastructure (SAGE-SRV, DC-SRV)."
          />

          {/* Synthèse KPI – Services */}
          <SubTitle text="Synthèse KPI – Services" />
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: NAVY }}>
                <th className={THN} style={{ width: '15%' }}>Serveur</th>
                <th className={THN} style={{ width: '25%' }}>Indicateur</th>
                <th className={THN} style={{ width: '15%' }}>Valeur (30 jours)</th>
                <th className={THN}>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {serviceKpiRows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                  <td className={TDB}>{row.server}</td>
                  <td className={TDR}>{row.indicator}</td>
                  <td className={TDR}>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{
                        backgroundColor: row.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                        color: row.ok ? '#059669' : '#DC2626',
                      }}
                    >
                      {row.value}
                    </span>
                  </td>
                  <td className={TDR}>{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Disponibilité Agents – détail */}
          {agentData.length > 0 && (
            <>
              <SubTitle text="Disponibilité des Agents Zabbix – Détail" />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: NAVY }}>
                    <th className={THN}>Hôte</th>
                    <th className={THN}>Statut actuel</th>
                    <th className={THN}>Disponibilité (30j)</th>
                    <th className={THN}>Vérifications</th>
                    <th className={THN}>Dernière Indisponibilité</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.map((agent, i) => {
                    const avail = Number(agent.availability_pct);
                    const color = avail >= 99 ? '#059669' : avail >= 95 ? '#D97706' : '#DC2626';
                    const online = String(agent.current_status) === '1';
                    return (
                      <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                        <td className={TDB}>{agent.host}</td>
                        <td className={TDR}>
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ backgroundColor: online ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: online ? '#059669' : '#DC2626' }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: online ? '#10B981' : '#EF4444' }} />
                            {online ? 'En ligne' : 'Hors ligne'}
                          </span>
                        </td>
                        <td className={TDR}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: hexRgba(color, 0.1) }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(avail, 100)}%`, background: `linear-gradient(90deg, ${color} 0%, ${hexRgba(color, 0.8)} 100%)` }} />
                            </div>
                            <span className="text-[12px] font-bold" style={{ color }}>{avail.toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className={TDR}>{agent.total_checks.toLocaleString()}</td>
                        <td className={TDR}>
                          {agent.last_unavailable ? new Date(agent.last_unavailable).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* Uptime Serveurs – détail */}
          {uptimeData.length > 0 && (
            <>
              <SubTitle text="Uptime des Serveurs – Détail" />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: NAVY }}>
                    <th className={THN}>Serveur</th>
                    <th className={THN}>Uptime Actuel</th>
                    <th className={THN}>Redémarrages (30j)</th>
                    <th className={THN}>Dernier Redémarrage</th>
                  </tr>
                </thead>
                <tbody>
                  {uptimeData.map((u, i) => (
                    <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                      <td className={TDB}>{u.host}</td>
                      <td className={TDR}>
                        <span className="font-semibold" style={{ color: NAVY }}>{formatUptime(u.current_uptime_seconds)}</span>
                      </td>
                      <td className={TDR}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{
                            backgroundColor: u.restart_count === 0 ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
                            color: u.restart_count === 0 ? '#059669' : '#D97706',
                          }}
                        >
                          {u.restart_count}
                        </span>
                      </td>
                      <td className={TDR}>
                        {u.last_restart_time ? new Date(u.last_restart_time).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Services applicatifs – synthèse running/anomaly/stopped */}
          {totalServicesMonitored > 0 && (
            <>
              <SubTitle text="Disponibilité des Services Applicatifs – Synthèse" />
              <p className="text-[12px] text-[#64748B] mb-3">
                {totalServicesMonitored} services supervisés · {serviceData.length} serveur(s)
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Running', count: globalRunning, bg: '#ECFDF5', border: '#D1FAE5', color: '#059669' },
                  { label: 'Anomalie', count: globalAnomaly, bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
                  { label: 'Arrêté', count: globalStopped, bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
                ].map(({ label, count, bg, border, color }) => (
                  <div key={label} className="text-center p-4 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }}>
                    <p className="text-[28px] font-extrabold" style={{ color }}>{count}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color }}>{label}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Charts: service state per day ── */}
          {reportCharts && reportCharts.services.length > 0 && (
            <>
              <SubTitle text="Évolution de l'état des services (30 jours)" />
              <div className="grid grid-cols-2 gap-4">
                {reportCharts.services.map((svc) => {
                  const hasIncident = svc.data.some(d => d.max > 0);
                  const incidentDays = svc.data.filter(d => d.max > 0).length;
                  const firstInc = svc.data.find(d => d.max > 0)?.day;
                  const accent = hasIncident ? '#F59E0B' : BRAND.green;
                  return (
                    <div key={svc.itemid} data-pdf-card="true" className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 2px 8px rgba(27,58,107,0.05)' }}>
                      {/* card header */}
                      <div className="flex items-start justify-between px-4 pt-3.5 pb-2" style={{ background: `linear-gradient(135deg, rgba(27,58,107,0.04) 0%, rgba(27,58,107,0) 70%)` }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight truncate">{svc.service}</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{svc.host} · état journalier</p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0" style={{ backgroundColor: hasIncident ? '#FEF3C7' : '#ECFDF5', color: hasIncident ? '#92400E' : '#065F46' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                          {hasIncident ? 'Anomalie' : 'Stable'}
                        </span>
                      </div>
                      {/* chart */}
                      <div style={{ height: 120, marginLeft: -2, marginRight: -2 }}>
                        <Chart
                          options={serviceChartOpts(svc.data, hasIncident)}
                          series={[{ name: 'État', data: svc.data.map(d => d.max > 0 ? 0 : 1) }]}
                          type="area"
                          height="100%"
                        />
                      </div>
                      {/* footer bullets */}
                      <div className="px-4 pt-2 pb-3.5 border-t border-[#F1F5F9] mt-1 space-y-1">
                        {hasIncident ? (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>⚠ {incidentDays} jour(s) d'anomalie{firstInc ? ` — premier : ${firstInc.slice(5)}` : ''}</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Consulter les logs Windows Service Control Manager</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#065F46' }}>✓ Aucun arrêt visible sur 30 jours</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Service opérationnel en continu</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Charts: uptime history ── */}
          {reportCharts && reportCharts.uptimes.length > 0 && (
            <>
              <SubTitle text="Évolution de l'uptime des serveurs (30 jours)" />
              <div className="grid grid-cols-2 gap-4">
                {reportCharts.uptimes.map((svc) => {
                  if (svc.data.length === 0) return (
                    <div key={svc.itemid} className="rounded-xl bg-white flex items-center justify-center" style={{ minHeight: 160, border: '1px solid #E8EDF3' }}>
                      <p className="text-[10px] text-[#94A3B8]">{svc.host} – Données insuffisantes</p>
                    </div>
                  );
                  const restartDays = svc.data.reduce<string[]>((acc, d, i) => {
                    if (i > 0 && d.avg < svc.data[i - 1].avg * 0.5) acc.push(d.day);
                    return acc;
                  }, []);
                  const maxUpDays = svc.data.reduce((m, d) => Math.max(m, d.avg / 86400), 0);
                  const hasRestart = restartDays.length > 0;
                  const accent = hasRestart ? '#F59E0B' : BRAND.darkBlue;
                  return (
                    <div key={svc.itemid} data-pdf-card="true" className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 2px 8px rgba(27,58,107,0.05)' }}>
                      <div className="flex items-start justify-between px-4 pt-3.5 pb-2" style={{ background: `linear-gradient(135deg, rgba(27,58,107,0.04) 0%, rgba(27,58,107,0) 70%)` }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{svc.host} – Uptime</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">Continu · une chute = redémarrage</p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0" style={{ backgroundColor: hasRestart ? '#FEF3C7' : '#EFF6FF', color: hasRestart ? '#92400E' : '#1E40AF' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                          {hasRestart ? `${restartDays.length} redém.` : 'Stable'}
                        </span>
                      </div>
                      <div style={{ height: 120, marginLeft: -2, marginRight: -2 }}>
                        <Chart
                          options={uptimeChartOpts(svc.data)}
                          series={[{ name: 'Uptime', data: svc.data.map(d => d.avg) }]}
                          type="area"
                          height="100%"
                        />
                      </div>
                      <div className="px-4 pt-2 pb-3.5 border-t border-[#F1F5F9] mt-1 space-y-1">
                        {hasRestart ? (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>⚠ {restartDays.length} redémarrage(s) détecté(s) : {restartDays.map(d => d.slice(5)).join(', ')}</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Vérifier les journaux Windows et les mises à jour</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#1E40AF' }}>✓ Aucun redémarrage sur 30 jours</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Uptime max observé : {maxUpDays.toFixed(1)} jours</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Charts: agent availability ── */}
          {reportCharts && reportCharts.agents.length > 0 && (
            <>
              <SubTitle text="Disponibilité journalière de l'agent Zabbix (30 jours)" />
              <div className="grid grid-cols-2 gap-4">
                {reportCharts.agents.map((svc) => {
                  const avgPct = svc.data.length > 0
                    ? svc.data.reduce((s, d) => s + d.avail_pct, 0) / svc.data.length : 0;
                  const minPct = svc.data.length > 0 ? Math.min(...svc.data.map(d => d.avail_pct)) : 0;
                  const ok = avgPct >= 99.5;
                  return (
                    <div key={svc.itemid} data-pdf-card="true" className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 2px 8px rgba(61,190,122,0.06)' }}>
                      <div className="flex items-start justify-between px-4 pt-3.5 pb-2" style={{ background: `linear-gradient(135deg, rgba(61,190,122,0.04) 0%, rgba(61,190,122,0) 70%)` }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{svc.host} – Agent Zabbix</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">Disponibilité journalière (%)</p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0" style={{ backgroundColor: ok ? '#ECFDF5' : '#FEF3C7', color: ok ? '#065F46' : '#92400E' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ok ? BRAND.green : '#F59E0B' }} />
                          {avgPct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ height: 120, marginLeft: -2, marginRight: -2 }}>
                        <Chart
                          options={agentChartOpts(svc.data)}
                          series={[{ name: 'Disponibilité', data: svc.data.map(d => d.avail_pct) }]}
                          type="area"
                          height="100%"
                        />
                      </div>
                      <div className="px-4 pt-2 pb-3.5 border-t border-[#F1F5F9] mt-1 space-y-1">
                        <p className="text-[10px] font-medium" style={{ color: ok ? '#065F46' : '#92400E' }}>
                          {ok ? '✓' : '⚠'} Disponibilité moyenne : {avgPct.toFixed(2)}%
                        </p>
                        <p className="text-[9.5px] text-[#64748B]">→ Minimum journalier : {minPct.toFixed(1)}%{minPct < 99 ? ' — indisponibilité à investiguer' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ════ SECTION 2 — RÉSEAU ════ */}
        <div className="space-y-5">
          <SectionDivider
            number="2)"
            title="Disponibilité réseau"
            subtitle="Périmètre : switches principaux et liaisons SFP surveillées."
          />

          {/* Synthèse KPI – Réseau */}
          <SubTitle text="Synthèse KPI – Réseau" />
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: NAVY }}>
                <th className={THN} style={{ width: '20%' }}>Équipement</th>
                <th className={THN} style={{ width: '22%' }}>Indicateur</th>
                <th className={THN} style={{ width: '22%' }}>Observation (30j)</th>
                <th className={THN}>Commentaire KPI</th>
              </tr>
            </thead>
            <tbody>
              {networkKpiRows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                  <td className={TDB}>{row.equip}</td>
                  <td className={TDR}>{row.indicator}</td>
                  <td className={TDR}>{row.obs}</td>
                  <td className={TDR}>{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Uptime Switches – détail */}
          {switchData.length > 0 && (
            <>
              <SubTitle text="Uptime des Switches Réseau – Détail" />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: NAVY }}>
                    <th className={THN}>Switch</th>
                    <th className={THN}>Uptime</th>
                    <th className={THN}>Ports UP / Total</th>
                    <th className={THN}>Ports DOWN</th>
                    <th className={THN}>Redémarrages</th>
                  </tr>
                </thead>
                <tbody>
                  {switchData.map((sw, i) => (
                    <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                      <td className={TDB}>{sw.switch_name}</td>
                      <td className={TDR}><span className="font-semibold" style={{ color: NAVY }}>{formatUptime(sw.current_uptime_seconds)}</span></td>
                      <td className={TDR}>
                        <span style={{ color: '#059669', fontWeight: 600 }}>{sw.up_ports}</span>
                        <span style={{ color: '#94A3B8' }}> / {sw.total_ports}</span>
                      </td>
                      <td className={TDR}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{ backgroundColor: sw.down_ports > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)', color: sw.down_ports > 0 ? '#DC2626' : '#059669' }}
                        >
                          {sw.down_ports}
                        </span>
                      </td>
                      <td className={TDR}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{ backgroundColor: sw.restart_count === 0 ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)', color: sw.restart_count === 0 ? '#059669' : '#D97706' }}
                        >
                          {sw.restart_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* SFP Ports – détail */}
          {sfpData.length > 0 && (
            <>
              <SubTitle text="Ports SFP — Statut des Liaisons Uplink" />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: NAVY }}>
                    <th className={THN}>Port</th>
                    <th className={THN}>Valeur Actuelle</th>
                    <th className={THN}>Moyenne</th>
                    <th className={THN}>Maximum</th>
                    <th className={THN}>Coupures (30j)</th>
                    <th className={THN}>Dernière Coupure</th>
                  </tr>
                </thead>
                <tbody>
                  {sfpData.map((port, i) => {
                    const downCount = Number(port.down_count);
                    const isDown = port.last_value !== null && Number(port.last_value) === 0;
                    return (
                      <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                        <td className={TDB}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isDown ? '#EF4444' : '#10B981' }} />
                            {port.port_name}
                          </div>
                        </td>
                        <td className={TDR}>{port.last_value !== null ? Number(port.last_value).toFixed(0) : '—'}</td>
                        <td className={TDR}>{port.avg_value !== null ? Number(port.avg_value).toFixed(1) : '—'}</td>
                        <td className={TDR}>{port.max_value !== null ? Number(port.max_value).toFixed(0) : '—'}</td>
                        <td className={TDR}>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                            style={{ backgroundColor: downCount === 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)', color: downCount === 0 ? '#059669' : '#DC2626' }}
                          >
                            {downCount}
                          </span>
                        </td>
                        <td className={TDR}>{port.last_down ? new Date(port.last_down).toLocaleDateString('fr-FR') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* ── Charts: switch uptime history ── */}
          {reportCharts && reportCharts.switchUptimes.length > 0 && (
            <>
              <SubTitle text="Évolution de l'uptime des switches (30 jours)" />
              <div className="grid grid-cols-2 gap-4">
                {reportCharts.switchUptimes.map((sw) => {
                  if (sw.data.length === 0) return (
                    <div key={sw.itemid} className="rounded-xl bg-white flex items-center justify-center" style={{ minHeight: 160, border: '1px solid #E8EDF3' }}>
                      <p className="text-[10px] text-[#94A3B8]">{sw.host} – Données insuffisantes</p>
                    </div>
                  );
                  const restartDays = sw.data.reduce<string[]>((acc, d, i) => {
                    if (i > 0 && d.avg < sw.data[i - 1].avg * 0.5) acc.push(d.day);
                    return acc;
                  }, []);
                  const maxUpWeeks = sw.data.reduce((m, d) => Math.max(m, d.avg / 604800), 0);
                  const hasRestart = restartDays.length > 0;
                  return (
                    <div key={sw.itemid} data-pdf-card="true" className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 2px 8px rgba(27,58,107,0.05)' }}>
                      <div className="flex items-start justify-between px-4 pt-3.5 pb-2" style={{ background: `linear-gradient(135deg, rgba(27,58,107,0.04) 0%, rgba(27,58,107,0) 70%)` }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{sw.host} – Uptime</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">Continu · chute = redémarrage switch</p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0" style={{ backgroundColor: hasRestart ? '#FEF3C7' : '#EFF6FF', color: hasRestart ? '#92400E' : '#1E40AF' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hasRestart ? '#F59E0B' : NAVY }} />
                          {hasRestart ? `${restartDays.length} redém.` : 'Stable'}
                        </span>
                      </div>
                      <div style={{ height: 120, marginLeft: -2, marginRight: -2 }}>
                        <Chart
                          options={switchChartOpts(sw.data)}
                          series={[{ name: 'Uptime', data: sw.data.map(d => d.avg) }]}
                          type="area"
                          height="100%"
                        />
                      </div>
                      <div className="px-4 pt-2 pb-3.5 border-t border-[#F1F5F9] mt-1 space-y-1">
                        {hasRestart ? (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>⚠ {restartDays.length} redémarrage(s) : {restartDays.map(d => d.slice(5)).join(', ')}</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Vérifier l'alimentation et les logs SNMP</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#1E40AF' }}>✓ Aucun redémarrage sur 30 jours</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Uptime max : {maxUpWeeks.toFixed(1)} semaines</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Charts: SFP port status ── */}
          {reportCharts && reportCharts.sfpPorts.length > 0 && (
            <>
              <SubTitle text="Statut journalier des liaisons SFP (30 jours)" />
              <div className="grid grid-cols-2 gap-4">
                {reportCharts.sfpPorts.map((port) => {
                  const downDays = port.data.filter(d => d.max >= 2);
                  const hasDown = downDays.length > 0;
                  const downFlags = port.data.map(d => d.max >= 2 ? 0 : 1);
                  // Short label: "SW1 – Port SFP 49" → "Port SFP 49" + host "SW1"
                  const [hostPart, ...rest] = port.label.split(' – ');
                  const portPart = rest.join(' – ') || port.label;
                  return (
                    <div key={port.itemid} data-pdf-card="true" className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 2px 8px rgba(27,58,107,0.05)' }}>
                      <div className="flex items-start justify-between px-4 pt-3.5 pb-2" style={{ background: `linear-gradient(135deg, rgba(27,58,107,0.04) 0%, rgba(27,58,107,0) 70%)` }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#0F172A] leading-tight truncate">{portPart}</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{hostPart} · statut ifOperStatus</p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0" style={{ backgroundColor: hasDown ? '#FEF2F2' : '#ECFDF5', color: hasDown ? '#991B1B' : '#065F46' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hasDown ? '#EF4444' : BRAND.green }} />
                          {hasDown ? `${downDays.length} coupure(s)` : 'UP stable'}
                        </span>
                      </div>
                      <div style={{ height: 120, marginLeft: -2, marginRight: -2 }}>
                        <Chart
                          options={sfpChartOpts(port.data, hasDown)}
                          series={[{ name: 'État SFP', data: downFlags }]}
                          type="area"
                          height="100%"
                        />
                      </div>
                      <div className="px-4 pt-2 pb-3.5 border-t border-[#F1F5F9] mt-1 space-y-1">
                        {hasDown ? (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#991B1B' }}>⚠ {downDays.length} jour(s) de coupure SFP détecté(s)</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Vérifier le câble SFP et la négociation de liaison</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-medium" style={{ color: '#065F46' }}>✓ Liaison SFP stable — aucune coupure sur 30 jours</p>
                            <p className="text-[9.5px] text-[#64748B]">→ Port {hostPart} opérationnel en continu</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ════ SECTION 3 — GLPI ════ */}
        {glpiKpi && (
          <div className="space-y-5">
            <SectionDivider
              number="3)"
              title={`Plateforme Tickets (GLPI) – Focus ${formatMonthFrLong(reportMonth)}`}
              subtitle="Focus sur : volumétrie, rapidité de traitement et taux de résolution (cible ≥ 90%)."
            />

            {/* Synthèse KPI – GLPI */}
            <SubTitle text={`Synthèse KPI – GLPI (${formatMonthFrLong(reportMonth)})`} />
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: NAVY }}>
                  <th className={THN} style={{ width: '30%' }}>{`Indicateur (${formatMonthFrLong(reportMonth)})`}</th>
                  <th className={THN} style={{ width: '18%' }}>Valeur</th>
                  <th className={THN}>Analyse KPI (bref)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    ind: 'Tickets créés (ouverture)',
                    val: `${glpiKpi.ticketsCreated}`,
                    ana: prevVol
                      ? `Activité ${glpiKpi.ticketsCreated < prevVol.tickets ? 'en baisse' : 'en hausse'} par rapport à ${formatMonthFrLong(prevVol.month)} (${prevVol.tickets} tickets).`
                      : 'Voir volumétrie mensuelle ci-dessous.',
                  },
                  {
                    ind: 'Tickets résolus / clos',
                    val: `${glpiKpi.ticketsClosed}`,
                    ana: glpiKpi.ticketsClosed >= glpiKpi.ticketsCreated
                      ? 'Tous les tickets du mois ont été clôturés.'
                      : `${glpiKpi.ticketsCreated - glpiKpi.ticketsClosed} ticket(s) encore ouverts en fin de période.`,
                  },
                  {
                    ind: 'Taux de résolution (cible 90%)',
                    val: `${glpiKpi.resolutionRate.toFixed(1)}% ${glpiKpi.resolutionRate >= 90 ? '✓' : '✗'}`,
                    ana: glpiKpi.resolutionRate >= 90
                      ? 'Taux de résolution calculé : (clos/créés) × 100 — cible atteinte.'
                      : 'Cible non atteinte — action corrective recommandée.',
                  },
                  {
                    ind: 'Time to Own (prise en charge)',
                    val: `${glpiKpi.timeToOwn.toFixed(1)} h`,
                    ana: ttoChangePct !== null
                      ? `${Math.abs(ttoChangePct).toFixed(1)}% ${ttoChangePct < 0 ? "d'amélioration" : "de dégradation"} vs mois précédent.`
                      : 'Prise en charge moyenne sur la période.',
                  },
                  {
                    ind: 'Time to Close (clôture)',
                    val: `${glpiKpi.timeToClose.toFixed(1)} h`,
                    ana: 'Délai global influencé par les demandes de service longues (workflows, validations).',
                  },
                ].map(({ ind, val, ana }, i) => (
                  <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                    <td className={TDB}>{ind}</td>
                    <td className={TDR}>{val}</td>
                    <td className={TDR}>{ana}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Ticket volume chart */}
            {glpiVolume.length > 0 && (
              <>
                <SubTitle text="Volumétrie des Tickets par Mois" />
                <div data-pdf-card="true" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                  <p className="text-[12px] text-[#94A3B8] mb-3">Volume mensuel de création de tickets</p>
                  <div className="h-56">
                    <Chart
                      options={volumeChartOpts}
                      series={[{ name: 'Tickets', data: glpiVolume.map(d => d.tickets) }]}
                      type="bar"
                      height="100%"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Time trends charts – SAME DESIGN as existing report page */}
            {glpiIncidentTrends && glpiDemandTrends && (
              <>
                <SubTitle text="Délais Moyens de Traitement – Time to Own / Time to Close (heures)" />
                <div data-pdf-card="true" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div data-pdf-card="true" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Délais Moyens — Incidents</p>
                    <p className="text-[12px] text-[#94A3B8] mb-3">Time to Own / Time to Close (heures)</p>
                    <div className="h-56">
                      <Chart
                        options={timeTrendsOpts(glpiIncidentTrends)}
                        series={incidentSeries}
                        type="area"
                        height="100%"
                      />
                    </div>
                  </div>
                  <div data-pdf-card="true" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Délais Moyens — Demandes</p>
                    <p className="text-[12px] text-[#94A3B8] mb-3">Time to Own / Time to Close (heures)</p>
                    <div className="h-56">
                      <Chart
                        options={timeTrendsOpts(glpiDemandTrends)}
                        series={demandSeries}
                        type="area"
                        height="100%"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Performance analysis block */}
            <div data-pdf-card="true" className="mt-4 rounded-xl border border-[#E2E8F0] overflow-hidden">
              {/* block header */}
              <div className="px-5 py-4" style={{ backgroundColor: NAVY }}>
                <p className="text-[13px] font-bold text-white">Rapport d'Analyse de Performance</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Analyse comparative approfondie basée sur les données des 30 derniers jours.
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] bg-white">

                {/* 1. Volume */}
                {lastVol && prevVol && (
                  <div className="flex items-start gap-4 px-5 py-5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: NAVY }}>1</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] mb-2">Volume des Tickets</p>
                      <p className="text-[12px] text-[#475569] mb-2.5">
                        Le nombre de tickets est passé de <strong>{prevVol.tickets}</strong> en {formatMonthFrLong(prevVol.month)}{' '}
                        à <strong>{lastVol.tickets}</strong> en {formatMonthFrLong(lastVol.month)}.
                      </p>
                      {volChangePct !== null && (
                        <>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2" style={{
                            backgroundColor: volChangePct < 0 ? 'rgba(5,150,105,0.09)' : 'rgba(220,38,38,0.07)',
                            color: volChangePct < 0 ? '#059669' : '#DC2626',
                          }}>
                            <span className="text-[12px] font-bold">
                              {volChangePct < 0 ? '✓ Réduction' : '⚠ Augmentation'} de ~{Math.abs(volChangePct).toFixed(1)}% vs {formatMonthFrLong(prevVol.month)}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-1.5 mb-2 inline-block">
                            KPI : ({prevVol.tickets} − {lastVol.tickets}) ÷ {prevVol.tickets} × 100 ≈ {(-volChangePct).toFixed(1)}%
                          </p>
                          <p className="text-[11px] text-[#64748B] italic">
                            {volChangePct < 0
                              ? "C'est une amélioration importante : moins d'incidents signalés, meilleure stabilité ou efficacité corrective."
                              : "Activité en hausse — identifier les causes récurrentes et renforcer les actions préventives."}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Time to Own */}
                {curTto !== undefined && (
                  <div className="flex items-start gap-4 px-5 py-5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: NAVY }}>2</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] mb-2">Temps de Prise en Charge</p>
                      <p className="text-[12px] text-[#475569] mb-1">
                        Time to Own = <strong>{curTto.toFixed(1)} heures</strong> en moyenne.
                      </p>
                      <p className="text-[12px] text-[#475569] mb-2.5">
                        Temps de réaction global{' '}
                        {curTto < 4 ? 'très satisfaisant' : curTto < 8 ? 'satisfaisant' : 'à améliorer'}{' '}
                        (~{(curTto / 24).toFixed(1)} j).
                      </p>
                      {ttoChangePct !== null && (
                        <>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2" style={{
                            backgroundColor: ttoChangePct < 0 ? 'rgba(5,150,105,0.09)' : 'rgba(220,38,38,0.07)',
                            color: ttoChangePct < 0 ? '#059669' : '#DC2626',
                          }}>
                            <span className="text-[12px] font-bold">
                              {ttoChangePct < 0 ? '✓ Amélioration' : '⚠ Temps de réaction allongé'} : {ttoChangePct > 0 ? '+' : ''}{ttoChangePct.toFixed(1)}% vs {prvTto !== undefined ? `${prvTto.toFixed(1)} h` : 'mois précédent'}
                            </span>
                          </div>
                          {prvTto !== undefined && (
                            <p className="text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-1.5 mb-2 inline-block">
                              KPI : ({prvTto.toFixed(1)} − {curTto.toFixed(1)}) ÷ {prvTto.toFixed(1)} × 100 ≈ {(-ttoChangePct).toFixed(1)}%
                            </p>
                          )}
                          <p className="text-[11px] text-[#64748B] italic">
                            {ttoChangePct < 0
                              ? "Délai en nette amélioration assurant aux utilisateurs une prise en compte rapide de leurs demandes."
                              : "Délai assurant aux utilisateurs une prise en compte rapide de leurs demandes."}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Délais de Clôture — uses trend data so it shows even if current-month kpi is empty */}
                {curTtc !== undefined && (
                  <div className="flex items-start gap-4 px-5 py-5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: NAVY }}>3</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] mb-2">Délais de Clôture</p>
                      <p className="text-[12px] text-[#475569] mb-1">
                        Time to Close = <strong>{curTtc.toFixed(1)} heures</strong> en moyenne.
                      </p>
                      {curTto !== undefined && (
                        <>
                          <p className="text-[12px] text-[#475569] mb-2.5">
                            Écart moyen entre prise en charge et clôture : <strong>{Math.max(0, curTtc - curTto).toFixed(1)} heures</strong>.
                          </p>
                          <p className="text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-1.5 mb-2 inline-block">
                            KPI : {curTtc.toFixed(1)} h − {curTto.toFixed(1)} h = {(curTtc - curTto).toFixed(1)} h
                          </p>
                        </>
                      )}
                      {ttcChangePct !== null && (
                        <>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2" style={{
                            backgroundColor: ttcChangePct < 0 ? 'rgba(5,150,105,0.09)' : 'rgba(220,38,38,0.07)',
                            color: ttcChangePct < 0 ? '#059669' : '#DC2626',
                          }}>
                            <span className="text-[12px] font-bold">
                              {ttcChangePct < 0 ? '✓ Résolution améliorée' : '⚠ Résolution allongée'} : {ttcChangePct > 0 ? '+' : ''}{ttcChangePct.toFixed(1)}% vs {prvTtc !== undefined ? `${prvTtc.toFixed(1)} h` : 'mois précédent'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] italic">
                            Le temps de clôture global est influencé principalement par les demandes de service longues (validations, approvisionnements).
                            Les incidents critiques et techniques restent résolus sous 2h.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ════ FOOTER ════ */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E2E8F0]">
          <img src={logoImg} alt="Arwamedic" style={{ height: 22, objectFit: 'contain', opacity: 0.45 }} />
          <p className="text-[10px] text-[#94A3B8] text-center">
            Rapport généré automatiquement · {todayStr} · Infrastructure IT / DSI
          </p>
          <p className="text-[10px] text-[#94A3B8]">Confidentiel</p>
        </div>
      </div>
    </div>
  );
};

export default PdfReport;
