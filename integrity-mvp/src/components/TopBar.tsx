import { Search, Bell, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import { useAgent } from '../contexts/AgentContext';
import { ConnectWalletButton } from './ConnectWalletButton';

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

  return (
    <div className="top-bar" style={{ gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {tabs && (
          <div style={{ display: 'flex', gap: '24px', marginLeft: '24px' }}>
            {tabs.map((tab) => (
              <div 
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{ 
                  color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  paddingBottom: '20px',
                  marginTop: '20px',
                  cursor: 'pointer'
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
                  color: 'white', 
                  outline: 'none',
                  marginLeft: '8px'
                }} 
              />
            </div>
            
            <Bell size={20} color="var(--text-secondary)" />

            <ConnectWalletButton />
          </>
        )}

      </div>
    </div>
  );
};
