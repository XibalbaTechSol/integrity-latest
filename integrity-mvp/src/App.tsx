import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './chain/wagmi';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { IdentityPage } from './pages/IdentityPage';
import { ContractsPage } from './pages/ContractsPage';
import { SettingsPage } from './pages/SettingsPage';
import { FinancePage } from './pages/FinancePage';
import { TraceAnalyticsPage } from './pages/TraceAnalyticsPage';
import { SystemDiagnosticsPage } from './pages/SystemDiagnosticsPage';
import { ShieldPage } from './pages/ShieldPage';
import { AgentsPage } from './pages/AgentsPage';
import { LandingPage } from './pages/LandingPage';
import './index.css';
import 'katex/dist/katex.min.css';

import { ThemeProvider } from './contexts/ThemeContext';
import { AgentProvider } from './contexts/AgentContext';
import { LoggerProvider } from './contexts/LoggerContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastManager } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { DevAutoLogin } from './components/DevAutoLogin';

const AppContent = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/landing';

  return (
    <div className={isLanding ? '' : 'app-container'}>
      {!isLanding && <Sidebar />}
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/identity" element={<IdentityPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/traces" element={<TraceAnalyticsPage />} />
        <Route path="/diagnostics" element={<SystemDiagnosticsPage />} />
        <Route path="/shield" element={<ShieldPage />} />
        <Route path="/agents" element={<AgentsPage />} />
      </Routes>
    </div>
  );
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LoggerProvider>
            <AgentProvider>
              <ToastProvider>
                <Router>
                  <DevAutoLogin />
                  <CommandPalette />
                  <AppContent />
                  <ToastManager />
                </Router>
              </ToastProvider>
            </AgentProvider>
          </LoggerProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
