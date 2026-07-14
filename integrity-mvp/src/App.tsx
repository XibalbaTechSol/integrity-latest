import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './chain/wagmi';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { IdentityPage } from './pages/IdentityPage';
import { ContractsPage } from './pages/ContractsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SdkTelemetryPage } from './pages/SdkTelemetryPage';
import { ExchangePage } from './pages/ExchangePage';
import { ChainOfThoughtPage } from './pages/ChainOfThoughtPage';
import { CompareTracesPage } from './pages/CompareTracesPage';
import { FinancePage } from './pages/FinancePage';
import { IntelligencePage } from './pages/IntelligencePage';
import { ShieldPage } from './pages/ShieldPage';
import { AgentsPage } from './pages/AgentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AuditPage } from './pages/AuditPage';
import { LandingPage } from './pages/LandingPage';
import './index.css';

import { ThemeProvider } from './contexts/ThemeContext';
import { AgentProvider } from './contexts/AgentContext';
import { LoggerProvider } from './contexts/LoggerContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastManager } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';

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
        <Route path="/telemetry" element={<SdkTelemetryPage />} />
        <Route path="/exchange" element={<ExchangePage />} />
        <Route path="/chain-of-thought" element={<ChainOfThoughtPage />} />
        <Route path="/compare-traces" element={<CompareTracesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        <Route path="/shield" element={<ShieldPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/audit" element={<AuditPage />} />
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
