import React from 'react';
import type { CpuDetail } from '../services/api';
import { Thermometer, Cpu, Activity, Server } from 'lucide-react';

interface CpuDetailsTableProps {
  data: CpuDetail[];
}

const CpuDetailsTable: React.FC<CpuDetailsTableProps> = ({ data }) => {
  const formatValue = (val: number | string | null, suffix: string = ''): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-[#CBD5E1]">N/A</span>;
    return <span className="font-medium text-[#0F172A]">{Number(val).toFixed(2)}{suffix}</span>;
  };

  const getTempBadge = (temp: number | string | null): React.ReactNode => {
    if (temp === null || temp === undefined) return null;
    const numTemp = Number(temp);
    if (numTemp > 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-full animate-pulse"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#DC2626' }} />
          Critical
        </span>
      );
    }
    if (numTemp > 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-full"
          style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#D97706' }} />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-full"
        style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#059669' }} />
        Normal
      </span>
    );
  };

  if (data.length === 0) {
    return (
      <div
        className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <Cpu className="w-10 h-10 mx-auto mb-3 text-[#CBD5E1]" />
        <p className="text-[14px] text-[#94A3B8]">No CPU details available</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#2B5BA8]" />
          <h3 className="text-[16px] font-semibold text-[#0F172A]">CPU Details & Telemetry</h3>
        </div>
        <span
          className="text-[12px] font-medium px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(43, 91, 168, 0.1)', color: '#2B5BA8' }}
        >
          Live Data
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Host Name</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Cores</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Utilization</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Load (1m)</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Temperature</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-[#F1F5F9] transition-colors duration-150 hover:bg-[#FAFBFF] group"
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] group-hover:bg-[rgba(43,91,168,0.1)] group-hover:text-[#2B5BA8] transition-colors duration-150">
                      <Server className="w-4 h-4" />
                    </div>
                    <span className="text-[14px] font-medium text-[#0F172A]">{row.host_name}</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-[14px]">{formatValue(row.cpu_cores)}</td>
                <td className="px-6 py-3.5 text-[14px]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#94A3B8]" />
                    {formatValue(row.cpu_utilization, '%')}
                  </div>
                </td>
                <td className="px-6 py-3.5 text-[14px]">{formatValue(row.cpu_load)}</td>
                <td className="px-6 py-3.5 text-[14px]">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-[#94A3B8]" />
                    {formatValue(row.cpu_temperature, '°C')}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  {getTempBadge(row.cpu_temperature) || <span className="text-[#CBD5E1]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CpuDetailsTable;
