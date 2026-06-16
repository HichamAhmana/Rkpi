import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar
          pageTitle="Dashboard"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          <Dashboard />
        </main>
      </div>
    </div>
  );
}

export default App;
