import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import GlpiDashboard from './pages/GlpiDashboard';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'zabbix' | 'glpi'>('zabbix');

  return (
    <div className="flex h-screen bg-page overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSidebarOpen(false); // Close mobile menu if open
        }}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar
          pageTitle={activeTab === 'zabbix' ? 'Supervision Infrastructure (Zabbix)' : 'Plateforme Helpdesk (GLPI)'}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-page">
          {activeTab === 'zabbix' ? <Dashboard /> : <GlpiDashboard />}
        </main>
      </div>
    </div>
  );
}

export default App;
