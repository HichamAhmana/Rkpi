import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';

interface NavbarProps {
  pageTitle?: string;
  onMenuToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ pageTitle = 'Dashboard', onMenuToggle }) => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh the "last updated" timestamp every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header
      className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between sticky top-0 z-30"
    >
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F0F7FF] text-[#64748B] transition-colors duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-[20px] font-semibold text-[#0F172A]">{pageTitle}</h1>
      </div>

      <span className="text-[13px] text-[#94A3B8] hidden sm:block">
        Last updated: {formatTimestamp(lastUpdated)}
      </span>
    </header>
  );
};

export default Navbar;
