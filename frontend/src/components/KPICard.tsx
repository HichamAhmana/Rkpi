import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  accentColor: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, accentColor, trend }) => {
  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-5 cursor-default
        transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        borderBottom: `3px solid ${accentColor}`,
      }}
    >
      {/* Icon circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
        style={{
          backgroundColor: `${accentColor}26`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>

      {/* Label */}
      <p className="text-[12px] font-normal text-[#64748B] mb-1">{title}</p>

      {/* Value */}
      <div className="flex items-end justify-between">
        <span className="text-[32px] font-bold leading-none text-[#0F172A]">{value}</span>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-1 pb-1">
            {trend.isUp ? (
              <TrendingUp className="w-4 h-4" style={{ color: '#3DBE7A' }} />
            ) : (
              <TrendingDown className="w-4 h-4" style={{ color: '#EF4444' }} />
            )}
            <span
              className="text-[12px] font-medium"
              style={{ color: trend.isUp ? '#3DBE7A' : '#EF4444' }}
            >
              {trend.value}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
