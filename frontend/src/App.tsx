import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import GlpiDashboard from './pages/GlpiDashboard';
import PdfReport from './pages/PdfReport';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'zabbix' | 'glpi' | 'report'>('zabbix');

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="flex h-screen bg-page overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar
          pageTitle={
            activeTab === 'zabbix'
              ? 'Supervision Infrastructure (Zabbix)'
              : activeTab === 'glpi'
                ? 'Plateforme Helpdesk (GLPI)'
                : "Rapport d'Activité & Performance"
          }
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-page">
          {activeTab === 'zabbix' ? <Dashboard /> : activeTab === 'glpi' ? <GlpiDashboard /> : <PdfReport />}
        </main>
      </div>
    </div>
  );
}

export default App;
