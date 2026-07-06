import React from 'react';
import type { AgentAvailability } from '../services/api';

interface AgentAvailabilityCardProps {
  agent: AgentAvailability;
}

const getAvailabilityColor = (value: number): string => {
  if (value >= 99) return '#3DBE7A';
  if (value >= 95) return '#F59E0B';
  return '#EF4444';
};

const AgentAvailabilityCard: React.FC<AgentAvailabilityCardProps> = ({ agent }) => {
  const color = getAvailabilityColor(agent.availability);
  const percentage = Math.min(agent.availability, 100);

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-5 cursor-default
        transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: '4px solid #3A9DBF',
      }}
    >
      {/* Server name */}
      <p className="text-[18px] font-semibold text-[#0F172A] mb-2">
        {agent.host_name}
      </p>

      {/* Availability percentage */}
      <p
        className="text-[28px] font-bold leading-tight mb-1"
        style={{ color }}
      >
        {agent.availability.toFixed(2)}%
      </p>

      {/* Label */}
      <p className="text-[18px] text-[#94A3B8] mb-3">
        Zabbix Agent Availability — 30 days
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

export default AgentAvailabilityCard;
