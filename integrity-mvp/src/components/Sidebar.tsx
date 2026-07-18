import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Users,
  Fingerprint,
  Settings,
  Code,
  Activity,
  Network,
  DollarSign,
  Brain,
  ShieldCheck,
  User,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { userapi, getToken, clearToken, type UserResponse } from '../services/userapi';

export const Sidebar = () => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Real userapi session — no more hardcoded "Admin User". If a JWT is in
  // sessionStorage (put there by SettingsPage's real login form), fetch the
  // real account via GET /me and show that email; otherwise show a "Sign in"
  // affordance. This is what makes the profile a real session rather than a
  // disclosed-fake one (previously carried a SeededDataBadge saying exactly
  // that).
  const [user, setUser] = useState<UserResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const refreshSession = () => {
    if (!getToken()) {
      setUser(null);
      setAuthChecked(true);
      return;
    }
    userapi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        // Token present but rejected (expired / server restarted with a new
        // signing key) — treat as logged out rather than showing a stale
        // identity, and drop the dead token so we don't retry it forever.
        clearToken();
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  };

  useEffect(() => {
    refreshSession();
    // sessionStorage changes from another tab, and our own login/logout,
    // both surface through a 'storage'/custom event so the shell updates
    // without a full reload.
    const onAuthChange = () => refreshSession();
    window.addEventListener('storage', onAuthChange);
    window.addEventListener('integrity-auth-changed', onAuthChange);
    return () => {
      window.removeEventListener('storage', onAuthChange);
      window.removeEventListener('integrity-auth-changed', onAuthChange);
    };
  }, []);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setIsProfileOpen(false);
    window.dispatchEvent(new Event('integrity-auth-changed'));
    navigate('/settings');
  };

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
        <SidebarItem to="/" icon={<Brain size={18} />} label="Intelligence" />
        <SidebarItem to="/agents" icon={<Users size={18} />} label="Agents" />
        <SidebarItem to="/identity" icon={<Fingerprint size={18} />} label="Identity" />
        
        <div className="sidebar-group-title" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '16px 16px 8px 16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Integrity Protocol</div>
        <SidebarItem to="/finance" icon={<DollarSign size={18} />} label="Finance Hub" />
        <SidebarItem to="/traces" icon={<Network size={18} />} label="Trace Analytics" />
        <SidebarItem to="/shield" icon={<ShieldCheck size={18} />} label="Shield Compliance" />
        
        <div className="sidebar-group-title" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '16px 16px 8px 16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>System</div>
        <SidebarItem to="/contracts" icon={<Code size={18} />} label="Contracts" />
        <SidebarItem to="/diagnostics" icon={<Activity size={18} />} label="Diagnostics" />

      </nav>
      
      <div style={{ position: 'relative' }}>
        <div 
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="sidebar-user-container"
          style={{ padding: isCollapsed ? '16px 12px' : '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', justifyContent: isCollapsed ? 'center' : 'flex-start', cursor: 'pointer' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: user ? 'var(--accent-primary)' : 'var(--bg-main)', border: user ? 'none' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: user ? '0 0 10px hsla(var(--accent-primary-hsl) / 0.3)' : 'none', flexShrink: 0 }}>
            {user ? <User size={18} color="white" /> : <LogIn size={18} color="var(--text-muted)" />}
          </div>
          <div className="sidebar-user-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: user ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user ? user.email : authChecked ? 'Sign in' : '…'}
            </span>
            {!isCollapsed && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user ? 'Signed in via userapi' : authChecked ? 'No active session' : ''}
              </span>
            )}
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
                <Settings size={16} /> {user ? 'Account Settings' : 'Sign in'}
              </div>
            </NavLink>
            {user && (
              <div className="glass-panel-hover" onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.9rem' }}>
                <PanelLeftClose size={16} /> Log Out
              </div>
            )}
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
