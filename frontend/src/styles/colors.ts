// Arwamedic Brand Palette
// Use these ONLY for accents: borders, icons, badges, chart colors, hover states, active indicators.
// Never use as full backgrounds.

export const BRAND = {
  green: '#3DBE7A',
  darkBlue: '#2B5BA8',
  lightGreen: '#4DB863',
  tealBlue: '#3A9DBF',
  lavenderBlue: '#6B8FD4',
  mediumBlue: '#2563B0',
} as const;

// Semantic status colors
export const STATUS = {
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  orange: '#F59E0B',
  red: '#EF4444',
} as const;

// Text colors
export const TEXT = {
  heading: '#0F172A',
  body: '#475569',
  label: '#94A3B8',
  muted: '#64748B',
} as const;

// Surface & border colors
export const SURFACE = {
  page: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  hoverRow: '#FAFBFF',
  activeNavBg: '#EFF6FF',
  hoverNavBg: '#F0F7FF',
} as const;

// Chart color palette (ordered for ApexCharts series)
export const CHART_COLORS = [
  BRAND.darkBlue,
  BRAND.green,
  BRAND.tealBlue,
  BRAND.lavenderBlue,
  BRAND.lightGreen,
  BRAND.mediumBlue,
] as const;

// KPI card accent colors
export const KPI_ACCENTS = {
  totalHosts: BRAND.darkBlue,
  online: BRAND.green,
  offline: '#EF4444',
  problems: '#F59E0B',
} as const;
