import React, { useState, useEffect } from 'react';
import { Menu, LogOut } from 'lucide-react';

interface NavbarProps {
  pageTitle?: string;
  onMenuToggle?: () => void;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ pageTitle = 'Dashboard', onMenuToggle, onLogout }) => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (date: Date): string =>
    date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F0F7FF] text-[#64748B] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-[20px] font-semibold text-[#0F172A]">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[13px] text-[#94A3B8] hidden sm:block">
          Last updated: {formatTimestamp(lastUpdated)}
        </span>
        {onLogout && (
          <button
            onClick={onLogout}
            title="Se déconnecter"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 transition-colors border border-[#E2E8F0] hover:border-red-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
