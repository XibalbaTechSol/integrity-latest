import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Fingerprint, 
  FileText, 
  ListChecks, 
  Settings,
  Code,
  Activity,
  LineChart,
  Network,
  GitCompare,
  DollarSign,
  Brain,
  ShieldCheck,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
          <NavLink to="/landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="https://xibalbatechsol.github.io/XibalbaSolutionsLogo.png" alt="Xibalba Solutions Logo" style={{ width: isCollapsed ? '40px' : '120px', height: 'auto', flexShrink: 0, transition: 'width 0.3s ease' }} />
          </NavLink>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          style={{ position: 'absolute', right: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '26px', height: '26px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>
      
      <nav style={{ padding: '0 12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div className="sidebar-group-title" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '16px 16px 8px 16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Core</div>
        <SidebarItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
        <SidebarItem to="/agents" icon={<Users size={18} />} label="Agents" />
        <SidebarItem to="/identity" icon={<Fingerprint size={18} />} label="Identity" />
        
        <div className="sidebar-group-title" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '16px 16px 8px 16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Integrity Protocol</div>
        <SidebarItem to="/exchange" icon={<LineChart size={18} />} label="Markets Escrow" />
        <SidebarItem to="/chain-of-thought" icon={<Network size={18} />} label="Chain of Thought" />
        <SidebarItem to="/compare-traces" icon={<GitCompare size={18} />} label="Compare Traces" />
        <SidebarItem to="/telemetry" icon={<Activity size={18} />} label="SDK Telemetry" />
        <SidebarItem to="/finance" icon={<DollarSign size={18} />} label="Finance" />
        <SidebarItem to="/intelligence" icon={<Brain size={18} />} label="Intelligence" />
        <SidebarItem to="/shield" icon={<ShieldCheck size={18} />} label="Shield Compliance" />
        
        <div className="sidebar-group-title" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '16px 16px 8px 16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>System</div>
        <SidebarItem to="/contracts" icon={<Code size={18} />} label="Contracts" />
        <SidebarItem to="/documents" icon={<FileText size={18} />} label="Documents" />
        <SidebarItem to="/audit" icon={<ListChecks size={18} />} label="Audit Logs" />

      </nav>
      
      <div style={{ position: 'relative' }}>
        <div 
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="sidebar-user-container"
          style={{ padding: isCollapsed ? '16px 12px' : '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', justifyContent: isCollapsed ? 'center' : 'flex-start', cursor: 'pointer' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px hsla(var(--accent-primary-hsl) / 0.3)', flexShrink: 0 }}>
            <User size={18} color="white" />
          </div>
          <div className="sidebar-user-details" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Admin User</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manager</span>
          </div>
        </div>

        {isProfileOpen && (
          <div className="card glass-panel" style={{ 
            position: 'absolute', 
            bottom: '100%', 
            left: '16px',
            width: isCollapsed ? '160px' : 'calc(100% - 32px)',
            marginBottom: '8px', 
            padding: '8px', 
            borderRadius: 'var(--radius-md)', 
            zIndex: 100,
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px' 
          }}>
            <NavLink to="/settings" style={{ textDecoration: 'none' }} onClick={() => setIsProfileOpen(false)}>
              <div className="glass-panel-hover" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                <Settings size={16} /> Settings
              </div>
            </NavLink>
            <div className="glass-panel-hover" onClick={() => setIsProfileOpen(false)} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.9rem' }}>
              <PanelLeftClose size={16} /> Log Out
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, label, to }: { icon: React.ReactNode, label: string, to: string }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
    >
      <div className="sidebar-item-glow"></div>
      <div className="sidebar-item-content">
        <span className="sidebar-item-icon">{icon}</span>
        <span className="sidebar-item-label">{label}</span>
      </div>
    </NavLink>
  );
};
