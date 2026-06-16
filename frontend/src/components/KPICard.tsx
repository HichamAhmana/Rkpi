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
  // Compute a lighter version for the gradient top
  const accentLight = `${accentColor}18`;
  const accentMedium = `${accentColor}30`;

  return (
    <div
      className="relative overflow-hidden rounded-xl cursor-default
        transition-all duration-300 ease-out
        hover:-translate-y-0.5 hover:shadow-xl group"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* Top gradient accent stripe */}
      <div
        className="h-[3px] w-full"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}AA, ${accentColor}55)`,
        }}
      />

      {/* Subtle background glow on hover */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100
          transition-opacity duration-500 blur-2xl pointer-events-none"
        style={{ backgroundColor: accentMedium }}
      />

      {/* Content */}
      <div className="px-4 py-3 flex items-center gap-3 relative z-10">
        {/* Icon badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
            transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${accentLight}, ${accentMedium})`,
          }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium tracking-wide uppercase text-[#94A3B8] leading-none mb-0.5">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-bold leading-tight text-[#0F172A]">
              {value}
            </span>

            {/* Trend indicator */}
            {trend && (
              <div
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: trend.isUp ? '#ECFDF5' : '#FEF2F2',
                  color: trend.isUp ? '#059669' : '#DC2626',
                }}
              >
                {trend.isUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.value}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPICard;
