import { Search, Bell, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import { useAgent } from '../contexts/AgentContext';
import { ConnectWalletButton } from './ConnectWalletButton';
import { SeededDataBadge } from '../shared/SeededDataBadge';

interface TopBarProps {
  title: string;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children?: React.ReactNode;
  hideControls?: boolean;
}

export const TopBar = ({ title, tabs, activeTab: externalActiveTab, onTabChange, children, hideControls }: TopBarProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs ? tabs[0] : '');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  
  const handleTabChange = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else setInternalActiveTab(tab);
  };
  
  const { agents, selectedAgentId, setSelectedAgentId, selectedAgent } = useAgent();
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  // No notifications endpoint exists anywhere in this monorepo (oracle.ts/
  // userapi.ts have neither) -- these are fixed seed content, not a live
  // feed, disclosed via SeededDataBadge in the dropdown header below.
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Oracle Connected', message: 'Integrity Oracle sync complete.', time: 'Just now', read: false },
    { id: 2, title: 'Policy Enforced', message: 'Agent attempted unapproved DEX swap. Blocked.', time: '2m ago', read: false },
    { id: 3, title: 'Attestation Verified', message: 'ZK proof validated for Context #892.', time: '1hr ago', read: true }
  ]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleBellClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
    if (!isNotificationOpen) {
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    }
  };

  return (
    <div className="top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', backgroundColor: 'var(--bg-main)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {tabs && (
          <div className="custom-scrollbar" style={{ display: 'flex', gap: '24px', marginLeft: '24px', overflowX: 'auto', paddingBottom: '2px' }}>
            {tabs.map((tab) => (
              <div 
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{ 
                  color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  paddingBottom: '20px',
                  marginTop: '20px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
        
        {/* Agent Selector Dropdown */}
        {!hideControls && (
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="glass-panel glass-panel-hover"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid hsla(var(--accent-primary-hsl) / 0.5)', background: 'hsla(var(--bg-panel-hsl) / 0.8)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Agent</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedAgent?.name || 'Select Agent'}</span>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" style={{ marginLeft: '8px' }} />
            </div>

            {isAgentDropdownOpen && (
              <div className="glass-panel" style={{ 
                position: 'absolute', top: '100%', right: 0, marginTop: '8px', 
                width: '220px', borderRadius: 'var(--radius-md)', zIndex: 50,
                display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px',
                border: '1px solid hsla(var(--border-color-hsl) / 0.5)'
              }}>
                {agents.map(agent => (
                  <div 
                    key={agent.id}
                    onClick={() => { setSelectedAgentId(agent.id); setIsAgentDropdownOpen(false); }}
                    className="glass-panel-hover"
                    style={{ 
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: agent.id === selectedAgentId ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{agent.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.did.substring(0, 16)}...</span>
                    </div>
                    {agent.id === selectedAgentId && <Check size={14} color="var(--accent-primary)" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Actions (Children) */}
        {children && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
            {children}
          </div>
        )}

        {!hideControls && (
          <>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: '#1c1f2a', 
              padding: '8px 12px', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <Search size={16} color="var(--text-secondary)" />
              <input 
                type="text" 
                placeholder="Search" 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-primary)', 
                  outline: 'none',
                  marginLeft: '8px'
                }} 
              />
            </div>
            
            <div style={{ position: 'relative' }}>
              <div onClick={handleBellClick} style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Bell size={20} color="var(--text-secondary)" />
                {unreadCount > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    background: 'var(--status-error)', color: 'var(--text-primary)',
                    fontSize: '9px', fontWeight: 'bold',
                    width: '14px', height: '14px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {unreadCount}
                  </div>
                )}
              </div>
              {isNotificationOpen && (
                <div className="glass-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '16px',
                  width: '320px', borderRadius: 'var(--radius-md)', zIndex: 100,
                  display: 'flex', flexDirection: 'column',
                  border: '1px solid hsla(var(--border-color-hsl) / 0.5)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid hsla(var(--border-color-hsl)/0.3)', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Notifications
                    <SeededDataBadge label="No notifications feed exists yet" />
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} className="glass-panel-hover" style={{
                        padding: '12px 16px', borderBottom: '1px solid hsla(var(--border-color-hsl)/0.1)',
                        opacity: n.read ? 0.7 : 1, cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{n.title}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.time}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ConnectWalletButton />
          </>
        )}

      </div>
    </div>
  );
};
