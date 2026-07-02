import React, { useState } from 'react';
import { LayoutGrid, ClipboardList, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { BRAND } from '../styles/colors';
import logoImg from '../../assets/logo.png';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: 'zabbix' | 'glpi' | 'report';
  onTabChange: (tab: 'zabbix' | 'glpi' | 'report') => void;
}

const NAV = [
  { id: 'zabbix' as const, label: 'Supervision',  sub: 'Infrastructure · Zabbix', icon: LayoutGrid },
  { id: 'glpi'   as const, label: 'Helpdesk',     sub: 'Tickets · GLPI',          icon: ClipboardList },
  { id: 'report' as const, label: 'Rapport',      sub: 'KPI · Export PDF',        icon: FileText },
];

// sidebar palette
const C = {
  bg:        'linear-gradient(175deg, #071929 0%, #0D2340 55%, #071929 100%)',
  border:    'rgba(255,255,255,0.07)',
  muted:     'rgba(255,255,255,0.28)',
  inactive:  'rgba(255,255,255,0.52)',
  active:    '#ffffff',
  activeBg:  'rgba(255,255,255,0.09)',
  hoverBg:   'rgba(255,255,255,0.055)',
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, activeTab, onTabChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {/* mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          lg:translate-x-0 lg:static lg:z-auto
          transition-all duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-17' : 'lg:w-58'}
          w-58
        `}
        style={{
          background: C.bg,
          borderRight: `1px solid ${C.border}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* dot-grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />

        {/* right-edge accent strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 2,
            height: '100%',
            background: `linear-gradient(to bottom, transparent 0%, ${BRAND.green}60 40%, ${BRAND.tealBlue}40 70%, transparent 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0' : '0 16px 0 20px',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          {isCollapsed ? (
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: BRAND.darkBlue,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              R
            </span>
          ) : (
            <>
              <img
                src={logoImg}
                alt="Arwamedic"
                style={{ height: 30, objectFit: 'contain', flexShrink: 0 }}
              />
              <button
                onClick={onToggle}
                className="lg:hidden"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 6,
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: C.inactive,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <nav
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            padding: isCollapsed ? '16px 8px' : '16px 10px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {!isCollapsed && (
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                padding: '0 10px',
                margin: '0 0 10px',
              }}
            >
              Navigation
            </p>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(({ id, label, sub, icon: Icon }) => {
              const active = id === activeTab;
              const isHov = hovered === id && !active;
              return (
                <li key={id}>
                  <a
                    href="#"
                    onClick={e => { e.preventDefault(); onTabChange(id); }}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                    title={isCollapsed ? label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isCollapsed ? 0 : 11,
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      padding: isCollapsed ? '11px 0' : '10px 10px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      backgroundColor: active ? C.activeBg : isHov ? C.hoverBg : 'transparent',
                      borderLeft: active ? `2px solid ${BRAND.green}` : '2px solid transparent',
                      transition: 'background-color 120ms, border-color 120ms',
                    }}
                  >
                    <Icon
                      size={17}
                      color={active ? '#fff' : isHov ? 'rgba(255,255,255,0.75)' : C.inactive}
                      style={{ flexShrink: 0, transition: 'color 120ms' }}
                    />
                    {!isCollapsed && (
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: active ? 600 : 500,
                            color: active ? C.active : isHov ? 'rgba(255,255,255,0.80)' : C.inactive,
                            margin: 0,
                            lineHeight: 1.3,
                            transition: 'color 120ms',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: active ? 'rgba(255,255,255,0.45)' : C.muted,
                            margin: 0,
                            lineHeight: 1.3,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sub}
                        </p>
                      </div>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            borderTop: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          {/* collapse toggle (desktop only) */}
          <button
            className="hidden lg:flex"
            onClick={() => setIsCollapsed(v => !v)}
            style={{
              width: '100%',
              alignItems: 'center',
              gap: 8,
              padding: isCollapsed ? '12px 0' : '10px 20px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.muted,
              fontSize: 12,
              borderBottom: `1px solid ${C.border}`,
              transition: 'color 150ms',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.inactive)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.muted)}
          >
            {isCollapsed
              ? <ChevronRight size={14} />
              : <><ChevronLeft size={14} /><span>Réduire</span></>
            }
          </button>

          {/* status line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: 7,
              padding: isCollapsed ? '12px 0' : '12px 20px',
            }}
            title={isCollapsed ? 'Tous systèmes opérationnels' : undefined}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: BRAND.green,
                flexShrink: 0,
                boxShadow: `0 0 6px ${BRAND.green}80`,
              }}
            />
            {!isCollapsed && (
              <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                Tous systèmes opérationnels
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
