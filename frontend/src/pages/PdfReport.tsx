import React, { useEffect, useState } from 'react';
import {
  FileText, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
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
} from '../services/api';

// ─── Module-level date constants ───────────────────────────────────────────────
const _now = new Date();
const _ago30 = new Date(_now);
_ago30.setDate(_now.getDate() - 30);
const periodFrom = _ago30.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const periodTo = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// ─── Safe hex→rgba for inline styles (avoids 8-digit hex alpha) ───────────────
const hexRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Table style constants (matching dark navy headers) ────────────────────────
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
  const [loading, setLoading] = useState(true);

  const [serviceData, setServiceData] = useState<ServerServices[]>([]);
  const [agentData, setAgentData] = useState<AgentStat[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimeStat[]>([]);
  const [sfpData, setSfpData] = useState<SfpPortStat[]>([]);
  const [switchData, setSwitchData] = useState<SwitchUptimeStat[]>([]);
  const [glpiKpi, setGlpiKpi] = useState<GlpiKpiSummary | null>(null);
  const [glpiVolume, setGlpiVolume] = useState<GlpiTicketVolume[]>([]);
  const [glpiIncidentTrends, setGlpiIncidentTrends] = useState<GlpiTimeTrends | null>(null);
  const [glpiDemandTrends, setGlpiDemandTrends] = useState<GlpiTimeTrends | null>(null);
  // The month actually used for the KPI section (falls back to latest month with data)
  const [reportMonth, setReportMonth] = useState(currentMonth);

  useEffect(() => {
    (async () => {
      try {
        const [
          services, agents, uptimes, sfpPorts, switches,
          kpiInitial, volume, incidentTrends, demandTrends,
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
      } catch (e) {
        console.error('PdfReport fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  // Count-based availability rates (count meeting threshold ÷ total × 100) — distinct
  // from avgAgentAvail above, which averages each agent's own % rather than counting them.
  const agentAvailCount = agentData.filter(a => Number(a.availability_pct) >= 99).length;
  const agentAvailPct = agentData.length > 0 ? (agentAvailCount / agentData.length) * 100 : 0;

  const switchStableCount = switchData.filter(sw => sw.restart_count === 0).length;
  const switchStablePct = switchData.length > 0 ? (switchStableCount / switchData.length) * 100 : 0;

  const sfpStableCount = sfpData.filter(p => Number(p.down_count) === 0).length;
  const sfpStablePct = sfpData.length > 0 ? (sfpStableCount / sfpData.length) * 100 : 0;

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
        value: ok ? '0 arrêt' : `${svc.incident_days} jour(s)`,
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
      value: u.restart_count === 0 ? '0 redémarrage' : `${u.restart_count} redém.`,
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
  const prevVol = sortedVol.at(-2);

  const incTtoOwn = glpiIncidentTrends?.timeToOwn ?? [];
  const curTto = incTtoOwn.at(-1)?.value;
  const prvTto = incTtoOwn.at(-2)?.value;
  const ttoChangePct = curTto !== undefined && prvTto !== undefined && prvTto !== 0
    ? ((curTto - prvTto) / prvTto) * 100
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

  const todayStr = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ─── Row background helper ───────────────────────────────────────────────────
  const rowBg = (i: number) => i % 2 === 0 ? '#ffffff' : '#F8FAFC';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0]"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAVY}12` }}>
          <FileText className="w-5 h-5" style={{ color: NAVY }} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#0F172A]">Rapport KPI — Disponibilité & Continuité</p>
          <p className="text-[12px] text-[#94A3B8]">Période : {periodFrom} → {periodTo} (30 derniers jours)</p>
        </div>
      </div>

      {/* ── Report body ── */}
      <div className="bg-white p-8 space-y-10" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>

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
                    <span className="inline-flex items-center gap-1">
                      {row.ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {row.value}
                    </span>
                  </td>
                  <td className={TDR}>{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Services applicatifs – synthèse running/anomaly/stopped */}
          {totalServicesMonitored > 0 && (
            <>
              <SubTitle text="Disponibilité des Services Applicatifs – Synthèse" />
              <p className="text-[12px] text-[#64748B] mb-3">
                {totalServicesMonitored} services supervisés · {serviceData.length} serveur(s)
              </p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Running', value: `${globalRunning}`, bg: '#ECFDF5', border: '#D1FAE5', color: '#059669' },
                  { label: 'Anomalie', value: `${globalAnomaly}`, bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
                  { label: 'Arrêté', value: `${globalStopped}`, bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
                  {
                    label: 'Disponibilité',
                    value: `${globalAvailPct}%`,
                    bg: globalAvailPct >= 90 ? '#ECFDF5' : '#FFFBEB',
                    border: globalAvailPct >= 90 ? '#D1FAE5' : '#FDE68A',
                    color: globalAvailPct >= 90 ? '#059669' : '#D97706',
                  },
                ].map(({ label, value, bg, border, color }) => (
                  <div key={label} className="text-center p-4 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }}>
                    <p className="text-[28px] font-extrabold" style={{ color }}>{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color }}>{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] mt-2.5 text-[#94A3B8]">
                Calcul : {globalRunning} service(s) opérationnel(s) ÷ {totalServicesMonitored} service(s) supervisé(s) × 100.
              </p>
            </>
          )}

          {/* Disponibilité des Agents Zabbix – synthèse (count / total × 100) */}
          {agentData.length > 0 && (
            <>
              <SubTitle text="Disponibilité des Agents Zabbix – Synthèse" />
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Disponibles (≥99%)', value: `${agentAvailCount}`, bg: '#ECFDF5', border: '#D1FAE5', color: '#059669' },
                  { label: 'Sous le seuil (<99%)', value: `${agentData.length - agentAvailCount}`, bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
                  {
                    label: 'Taux de disponibilité',
                    value: `${agentAvailPct.toFixed(0)}%`,
                    bg: agentAvailPct >= 90 ? '#ECFDF5' : '#FFFBEB',
                    border: agentAvailPct >= 90 ? '#D1FAE5' : '#FDE68A',
                    color: agentAvailPct >= 90 ? '#059669' : '#D97706',
                  },
                ].map(({ label, value, bg, border, color }) => (
                  <div key={label} className="text-center p-4 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }}>
                    <p className="text-[28px] font-extrabold" style={{ color }}>{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color }}>{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] mt-2.5 text-[#94A3B8]">
                Calcul : {agentAvailCount} agent(s) avec disponibilité ≥ 99% ÷ {agentData.length} agent(s) supervisé(s) × 100.
              </p>
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

          {/* Disponibilité réseau – synthèse (count / total × 100) */}
          {(switchData.length > 0 || sfpData.length > 0) && (
            <>
              <SubTitle text="Disponibilité Réseau – Synthèse" />
              <div className="grid grid-cols-2 gap-4">
                {switchData.length > 0 && (
                  <div
                    className="text-center p-4 rounded-xl border"
                    style={{
                      backgroundColor: switchStablePct >= 90 ? '#ECFDF5' : '#FFFBEB',
                      borderColor: switchStablePct >= 90 ? '#D1FAE5' : '#FDE68A',
                    }}
                  >
                    <p className="text-[28px] font-extrabold" style={{ color: switchStablePct >= 90 ? '#059669' : '#D97706' }}>
                      {switchStablePct.toFixed(0)}%
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: switchStablePct >= 90 ? '#059669' : '#D97706' }}>
                      Switches sans redémarrage — {switchStableCount}/{switchData.length}
                    </p>
                  </div>
                )}
                {sfpData.length > 0 && (
                  <div
                    className="text-center p-4 rounded-xl border"
                    style={{
                      backgroundColor: sfpStablePct >= 90 ? '#ECFDF5' : '#FFFBEB',
                      borderColor: sfpStablePct >= 90 ? '#D1FAE5' : '#FDE68A',
                    }}
                  >
                    <p className="text-[28px] font-extrabold" style={{ color: sfpStablePct >= 90 ? '#059669' : '#D97706' }}>
                      {sfpStablePct.toFixed(0)}%
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: sfpStablePct >= 90 ? '#059669' : '#D97706' }}>
                      Ports SFP stables — {sfpStableCount}/{sfpData.length}
                    </p>
                  </div>
                )}
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
                    val: (
                      <span className="inline-flex items-center gap-1">
                        {glpiKpi.resolutionRate.toFixed(1)}%
                        {glpiKpi.resolutionRate >= 90
                          ? <CheckCircle className="w-3 h-3 shrink-0" />
                          : <AlertCircle className="w-3 h-3 shrink-0" />}
                      </span>
                    ),
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
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
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

            {/* Time trends charts */}
            {glpiIncidentTrends && glpiDemandTrends && (
              <>
                <SubTitle text="Délais Moyens de Traitement – Time to Own / Time to Close (heures)" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
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
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
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
