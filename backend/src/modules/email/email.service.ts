import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { ZabbixService } from '../../zabbix/zabbix.service';
import { GlpiService } from '../glpi/glpi.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private zabbixService: ZabbixService,
    private glpiService: GlpiService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendReportEmail(pdfBase64: string, filename: string, monthLabel: string): Promise<void> {
    const to = this.configService.get<string>('REPORT_EMAIL', 'hichamahmana@gmail.com');
    const from = `"RKpi Dashboard" <${this.configService.get<string>('SMTP_USER')}>`;
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await this.transporter.sendMail({
      from,
      to,
      subject: `Rapport KPI Mensuel – ${monthLabel}`,
      html: this.buildCoverEmail(monthLabel),
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    });

    this.logger.log(`Report email sent to ${to} for ${monthLabel}`);
  }

  // Runs at 08:00 on the 1st of every month — sends previous month KPI report
  @Cron('0 8 1 * *')
  async sendMonthlyReport(): Promise<void> {
    const prevMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    this.logger.log(`Running monthly cron for period: ${prevMonth}`);

    try {
      const [glpiSummary, volumeData, uptimeStats, agentStats, switchStats] = await Promise.all([
        this.glpiService.getKpiSummary(prevMonth),
        this.glpiService.getTicketVolume(),
        this.zabbixService.getUptimeStats(),
        this.zabbixService.getAgentAvailabilityStats(),
        this.zabbixService.getSwitchUptimeStats(),
      ]);

      const html = this.buildMonthlyHtmlEmail(prevMonth, glpiSummary, uptimeStats as any[], agentStats as any[], switchStats as any[]);
      const to = this.configService.get<string>('REPORT_EMAIL', 'hichamahmana@gmail.com');

      await this.transporter.sendMail({
        from: `"RKpi Dashboard" <${this.configService.get<string>('SMTP_USER')}>`,
        to,
        subject: `[AUTO] Rapport KPI – ${prevMonth}`,
        html,
      });

      this.logger.log(`Monthly auto-report sent to ${to}`);
    } catch (err) {
      this.logger.error('Failed to send monthly report', err);
    }
  }

  private buildCoverEmail(monthLabel: string): string {
    return `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#F8FAFC;padding:32px 0;">
        <div style="background:#2B5BA8;border-radius:12px 12px 0 0;padding:28px 32px;">
          <h1 style="color:white;margin:0;font-size:20px;font-weight:700;">RKpi Dashboard</h1>
          <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">Rapport KPI Mensuel — ${monthLabel}</p>
        </div>
        <div style="background:white;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px;">
          <p style="color:#475569;font-size:14px;line-height:1.6;">
            Veuillez trouver ci-joint le rapport KPI mensuel consolidé pour la période <strong>${monthLabel}</strong>.
          </p>
          <p style="color:#475569;font-size:13px;margin-top:16px;">
            Ce rapport contient :<br/>
            &bull; Disponibilité des services Zabbix (SAGE-SRV, DC-SRV)<br/>
            &bull; Disponibilité du réseau (switches SFP)<br/>
            &bull; KPIs Helpdesk GLPI (tickets, délais, taux de résolution)
          </p>
          <p style="color:#94A3B8;font-size:12px;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px;">
            Généré automatiquement par RKpi Dashboard System
          </p>
        </div>
      </div>`;
  }

  private buildMonthlyHtmlEmail(
    month: string,
    glpi: any,
    uptimes: any[],
    agents: any[],
    switches: any[],
  ): string {
    const fmtMonth = (m: string) => {
      const months: Record<string, string> = {
        '01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin',
        '07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre',
      };
      const [y, mo] = m.split('-');
      return `${months[mo] || mo} ${y}`;
    };

    const label = fmtMonth(month);
    const targetMet = glpi.resolutionRate >= 90;

    const uptimeRows = (uptimes || []).map((u: any) => `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:10px 12px;font-weight:600;color:#0F172A;">${u.host || u.host_name || '—'}</td>
        <td style="padding:10px 12px;color:#475569;">${Math.floor((u.current_uptime_seconds || 0) / 86400)} jours</td>
        <td style="padding:10px 12px;color:${(u.restart_count || 0) > 0 ? '#EF4444' : '#059669'};font-weight:600;">${u.restart_count || 0}</td>
      </tr>`).join('');

    const agentRows = (agents || []).map((a: any) => `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:10px 12px;font-weight:600;color:#0F172A;">${a.host || a.host_name || '—'}</td>
        <td style="padding:10px 12px;color:${Number(a.availability_pct || 0) >= 99 ? '#059669' : '#D97706'};font-weight:600;">${Number(a.availability_pct || 0).toFixed(2)}%</td>
      </tr>`).join('');

    const switchRows = (switches || []).map((s: any) => `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:10px 12px;font-weight:600;color:#0F172A;">${s.switch_name || '—'}</td>
        <td style="padding:10px 12px;color:#475569;">${((s.current_uptime_seconds || 0) / (7 * 86400)).toFixed(1)} semaines</td>
      </tr>`).join('');

    return `
      <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#F8FAFC;padding:32px 0;">
        <div style="background:#2B5BA8;border-radius:12px 12px 0 0;padding:28px 32px;">
          <h1 style="color:white;margin:0;font-size:20px;font-weight:700;">RKpi Dashboard — Rapport Mensuel</h1>
          <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">Période : ${label}</p>
        </div>
        <div style="background:white;border:1px solid #E2E8F0;border-top:none;padding:28px 32px;">

          <!-- GLPI KPIs -->
          <h2 style="font-size:15px;color:#0F172A;margin:0 0 16px;border-bottom:2px solid #2B5BA8;padding-bottom:8px;">Plateforme GLPI – ${label}</h2>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
            ${[
              { label: 'Tickets Créés', value: glpi.ticketsCreated, color: '#2B5BA8' },
              { label: 'Tickets Clos', value: glpi.ticketsClosed, color: '#3DBE7A' },
              { label: 'Taux Résolution', value: `${glpi.resolutionRate.toFixed(1)}%`, color: targetMet ? '#3DBE7A' : '#EF4444' },
              { label: 'Time to Own', value: `${glpi.timeToOwn.toFixed(1)} h`, color: '#F59E0B' },
              { label: 'Time to Close', value: `${glpi.timeToClose.toFixed(1)} h`, color: '#E24A8D' },
            ].map(k => `
              <div style="flex:1;min-width:110px;background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid ${k.color};border-radius:8px;padding:12px;">
                <p style="margin:0 0 4px;font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${k.label}</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:#0F172A;">${k.value}</p>
              </div>`).join('')}
          </div>

          <!-- Zabbix Uptime -->
          <h2 style="font-size:15px;color:#0F172A;margin:0 0 12px;border-bottom:2px solid #3DBE7A;padding-bottom:8px;">Uptime Serveurs (30 jours)</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
            <thead><tr style="background:#F1F5F9;">
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Serveur</th>
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Uptime Courant</th>
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Redémarrages</th>
            </tr></thead>
            <tbody>${uptimeRows || '<tr><td colspan="3" style="padding:12px;color:#94A3B8;">Aucune donnée</td></tr>'}</tbody>
          </table>

          <!-- Agent Availability -->
          <h2 style="font-size:15px;color:#0F172A;margin:0 0 12px;border-bottom:2px solid #3A9DBF;padding-bottom:8px;">Disponibilité Agent Zabbix</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
            <thead><tr style="background:#F1F5F9;">
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Hôte</th>
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Disponibilité</th>
            </tr></thead>
            <tbody>${agentRows || '<tr><td colspan="2" style="padding:12px;color:#94A3B8;">Aucune donnée</td></tr>'}</tbody>
          </table>

          <!-- Switches -->
          <h2 style="font-size:15px;color:#0F172A;margin:0 0 12px;border-bottom:2px solid #0EA5E9;padding-bottom:8px;">Uptime Switches Réseau</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
            <thead><tr style="background:#F1F5F9;">
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Switch</th>
              <th style="padding:10px 12px;text-align:left;color:#64748B;font-weight:600;">Uptime</th>
            </tr></thead>
            <tbody>${switchRows || '<tr><td colspan="2" style="padding:12px;color:#94A3B8;">Aucune donnée</td></tr>'}</tbody>
          </table>

          <p style="color:#94A3B8;font-size:12px;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px;">
            Rapport généré automatiquement par RKpi Dashboard System — ${new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>`;
  }
}
