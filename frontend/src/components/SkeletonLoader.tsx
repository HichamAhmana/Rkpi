import React from 'react';

// ─── Skeleton Variants ──────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

/** Single rectangle skeleton block */
export const SkeletonBlock: React.FC<SkeletonProps & { width?: string; height?: string }> = ({
  width = '100%',
  height = '16px',
  className = '',
}) => (
  <div className={`skeleton ${className}`} style={{ width, height }} />
);

/** KPI card skeleton */
export const SkeletonKPICard: React.FC = () => (
  <div
    className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)' }}
  >
    <div className="skeleton h-[3px] w-full" />
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton w-16 h-2.5 mb-1.5" />
        <div className="skeleton w-10 h-5" />
      </div>
    </div>
  </div>
);

/** Table skeleton with header + rows */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => (
  <div
    className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
  >
    {/* Header */}
    <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-3">
      <div className="skeleton w-32 h-5" />
    </div>

    {/* Table header row */}
    <div className="px-6 py-3 bg-[#F8FAFC] flex gap-6">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="skeleton h-3 flex-1" />
      ))}
    </div>

    {/* Table rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="px-6 py-4 border-b border-[#F1F5F9] flex gap-6">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="skeleton h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

/** Chart skeleton */
export const SkeletonChart: React.FC = () => (
  <div
    className="bg-white rounded-xl border border-[#E2E8F0] p-6"
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
  >
    <div className="skeleton w-48 h-5 mb-2" />
    <div className="skeleton w-32 h-3 mb-6" />
    <div className="skeleton w-full h-[240px] rounded-lg" />
  </div>
);

/** Agent availability card skeleton */
export const SkeletonAgentCard: React.FC = () => (
  <div
    className="bg-white rounded-xl border border-[#E2E8F0] p-5"
    style={{
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      borderLeft: '4px solid #E2E8F0',
    }}
  >
    <div className="skeleton w-28 h-4 mb-3" />
    <div className="skeleton w-16 h-7 mb-2" />
    <div className="skeleton w-44 h-3 mb-3" />
    <div className="skeleton w-full h-1.5 rounded-full" />
  </div>
);

/** Full dashboard skeleton layout */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* KPI row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonKPICard key={i} />
      ))}
    </div>

    {/* Service availability table */}
    <SkeletonTable rows={4} cols={5} />

    {/* Agent cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonAgentCard key={i} />
      ))}
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2"><SkeletonChart /></div>
      <div><SkeletonChart /></div>
    </div>
  </div>
);

export default DashboardSkeleton;
