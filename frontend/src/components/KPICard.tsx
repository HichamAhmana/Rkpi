import React from 'react';
import { ArrowUpRight, ArrowDownRight, HelpCircle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  accentColor: string; // Hex code, e.g., '#2B5BA8'
  trend?: {
    value: number;
    isUp: boolean;
  };
  description?: string; // Optional contextual secondary text (e.g., "vs last month")
  tooltipText?: string;  // Optional micro-UX info tooltip
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon: Icon,
  accentColor,
  trend,
  description,
  tooltipText,
}) => {
  // Generate accurate color channels safely
  const hexToRgba = (hex: string, opacity: number) => {
    const sanitizedHex = hex.replace('#', '');
    const r = parseInt(sanitizedHex.substring(0, 2), 16);
    const g = parseInt(sanitizedHex.substring(2, 4), 16);
    const b = parseInt(sanitizedHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const bgTint = hexToRgba(accentColor, 0.04);
  const borderTint = hexToRgba(accentColor, 0.12);
  const glowTint = hexToRgba(accentColor, 0.08);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 
        transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        hover:-translate-y-1 hover:border-slate-300
        group select-none flex flex-col justify-between h-full"
      style={
        {
          '--hover-glow': `0 20px 30px -10px ${glowTint}, 0 0 0 1px ${borderTint} inset`,
        } as React.CSSProperties
      }
    >
      {/* Premium Dynamic Shadow Mask (Triggered on Hover via class state) */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl shadow-[var(--hover-glow)]" />

      {/* Decorative Top Accent Pipeline */}
      <div 
        className="absolute top-0 left-0 right-0 h-[3px] transition-all duration-300 group-hover:h-[4px]" 
        style={{ backgroundColor: accentColor }} 
      />

      {/* Card Header Layer */}
      <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[18px] font-bold tracking-wider uppercase text-slate-400 font-sans truncate">
            {title}
          </p>
          {tooltipText && (
            <div className="relative group/tooltip flex items-center shrink-0">
              <HelpCircle className="w-3.5 h-3.5 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[15px] font-medium rounded-md opacity-0 pointer-events-none transition-all duration-200 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 translate-y-1 shadow-md whitespace-nowrap z-30">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Interactive Icon Sphere */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-300 group-hover:scale-105"
          style={{
            backgroundColor: bgTint,
            borderColor: borderTint,
          }}
        >
          <Icon 
            className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-6" 
            style={{ color: accentColor }} 
          />
        </div>
      </div>

      {/* Core Display & Statistical Insights */}
      <div className="flex flex-col gap-2.5 relative z-10">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-[28px] font-extrabold tracking-tight leading-none text-slate-900 font-sans">
            {value}
          </span>

          {/* Micro-UX Trend Badge */}
          {trend && (
            <div
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[15px] font-bold border font-sans tracking-wide shrink-0 transition-all duration-200 group-hover:scale-102"
              style={{
                backgroundColor: trend.isUp ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: trend.isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: trend.isUp ? '#10B981' : '#EF4444',
              }}
            >
              {trend.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>

        {/* Optional Contextual Description Meta Label */}
        {description && (
          <div className="text-[18px] font-medium text-slate-400 font-sans tracking-normal border-t border-slate-100 pt-2.5 mt-0.5 flex items-center justify-between">
            <span className="truncate">{description}</span>
            <span className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-slate-300 transition-colors shrink-0 ml-2" />
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;