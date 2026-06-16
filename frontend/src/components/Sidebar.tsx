import React from 'react';
import { LayoutGrid, Server, Bell, Monitor, Settings, X } from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  active?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, active: true },
  { label: 'Infrastructure', icon: Server },
  { label: 'Events', icon: Bell },
  { label: 'Hosts', icon: Monitor },
  { label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-[240px] bg-white flex flex-col
          border-r border-[#E2E8F0]
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E2E8F0]">
          <span className="text-[22px] font-bold text-[#2B5BA8] tracking-tight">
            RKpi
          </span>
          <button
            onClick={onToggle}
            className="lg:hidden p-1 rounded-md hover:bg-[#F0F7FF] text-[#64748B] transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px]
                      transition-all duration-150
                      ${item.active
                        ? 'bg-[#EFF6FF] text-[#2B5BA8] font-semibold'
                        : 'text-[#64748B] hover:bg-[#F0F7FF] hover:text-[#2B5BA8]'
                      }
                    `}
                    style={item.active ? { borderLeft: '3px solid #2B5BA8' } : { borderLeft: '3px solid transparent' }}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3DBE7A]" />
            <span className="text-[12px] text-[#94A3B8]">All systems operational</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
