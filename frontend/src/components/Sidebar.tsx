import React, { useState } from 'react';
import { LayoutGrid, Monitor, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  active?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Zabbix M', icon: LayoutGrid, active: true },
  { label: 'GLPI M', icon: Monitor },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  // Desktop collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-white flex flex-col
          border-r border-[#E2E8F0]
          transition-all duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-[76px]' : 'lg:w-[240px]'}
          w-[240px]
        `}
      >
        {/* Logo Header */}
        <div className={`h-16 flex items-center justify-between border-b border-[#E2E8F0] px-6 transition-all duration-200 ${isCollapsed ? 'lg:px-4 lg:justify-center' : ''}`}>
          <span className="text-[22px] font-bold text-[#2B5BA8] tracking-tight whitespace-nowrap transition-all duration-200">
            {isCollapsed ? 'R' : 'RKpi'}
          </span>
          
          {/* Mobile close button / Desktop collapse toggle button */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              className="lg:hidden p-1 rounded-md hover:bg-[#F0F7FF] text-[#64748B] transition-colors duration-150"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Layer */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-1 px-3 transition-all duration-200">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    title={isCollapsed ? item.label : undefined}
                    className={`
                      flex items-center rounded-lg text-[14px]
                      transition-all duration-150 relative group
                      ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-3' : 'gap-3 px-3 py-2.5'}
                      ${item.active
                        ? 'bg-[#EFF6FF] text-[#2B5BA8] font-semibold'
                        : 'text-[#64748B] hover:bg-[#F0F7FF] hover:text-[#2B5BA8]'
                      }
                    `}
                    style={
                      item.active 
                        ? { borderLeft: '3px solid #2B5BA8' } 
                        : { borderLeft: '3px solid transparent' }
                    }
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    
                    {/* Collapsible text element */}
                    <span 
                      className={`
                        transition-all duration-200 whitespace-nowrap
                        ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}
                      `}
                    >
                      {item.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Action Tray & System Status Footer */}
        <div className="border-t border-[#E2E8F0] bg-white flex flex-col">
          {/* Desktop Expand/Collapse Trigger Arrow */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center py-2 text-[#64748B] hover:text-[#2B5BA8] hover:bg-[#F0F7FF] transition-colors duration-150 border-b border-[#E2E8F0]"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className={`py-4 transition-all duration-200 ${isCollapsed ? 'lg:px-0 lg:flex lg:justify-center' : 'px-6'}`}>
            <div className="flex items-center gap-2" title={isCollapsed ? "All systems operational" : undefined}>
              <span className="w-2 h-2 rounded-full bg-[#3DBE7A] shrink-0" />
              <span 
                className={`
                  text-[12px] text-[#94A3B8] whitespace-nowrap transition-all duration-200
                  ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}
                `}
              >
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;