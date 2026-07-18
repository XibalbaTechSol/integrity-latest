import { Key, Lock, Globe, Database, Terminal, ShieldAlert, Palette, FlaskConical, Copy, Check } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { userapi, type ApiKeyResponse, getToken } from '../services/userapi';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const SEED_COMMAND = 'cd integrity-sdk && MOCK=true FUNDER_PRIVATE_KEY=... INTEGRITY_WALLET_PASSWORD=... uv run python ../integrity-mvp/scripts/seed_mock_data.py';

export const SettingsPage = () => {
  const { theme, setTheme, font, setFont } = useTheme();
  const [copied, setCopied] = useState(false);

  // Live userapi auth & key state
  const [authed, setAuthed] = useState(!!getToken());
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const fetchKeys = () => {
    setLoadingKeys(true);
    userapi.listApiKeys()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoadingKeys(false));
  };

  useEffect(() => {
    if (authed) {
      fetchKeys();
    }
  }, [authed]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await userapi.login(email, password);
      setAuthed(true);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await userapi.register(email, password);
      setAuthed(true);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    }
  };

  const handleLogout = () => {
    userapi.logout();
    setAuthed(false);
    setKeys([]);
    setNewKey(null);
  };

  const handleGenerateKey = async () => {
    try {
      const res = await userapi.createApiKey();
      setNewKey(res.raw_key);
      fetchKeys();
    } catch (err: any) {
      window.alert(err.message || 'Failed to generate key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await userapi.revokeApiKey(id);
      fetchKeys();
    } catch (err: any) {
      window.alert(err.message || 'Failed to revoke key');
    }
  };
  return (
    <div className="main-content">
      {/* No page-wide "Save Changes" button: theme/font persist live via
          ThemeContext as you change them, API keys are revoked/created via
          real userapi calls immediately, and the Network panel below is
          already disclosed as non-functional (SeededDataBadge) -- nothing
          on this page needs, or previously had, a real save step behind a
          button that only ever fired a fake "saved to volatile memory"
          alert. */}
      <TopBar title="System Configuration" />

      <div className="page-content">
        <div className="grid grid-2">
          
          {/* Appearance Panel */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title text-gradient">Appearance & Theming</h3>
              <Palette size={20} className="text-muted" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div 
                onClick={() => setTheme('default')}
                style={{ 
                  border: theme === 'default' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', 
                  padding: '16px', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-main)' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6' }}></div> Default Dark
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Inter typography, deep dark panels, high contrast accents.</div>
              </div>
              <div 
                onClick={() => setTheme('navy-gold')}
                style={{ 
                  border: theme === 'navy-gold' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', 
                  padding: '16px', borderRadius: '8px', cursor: 'pointer', background: '#0a1128', color: '#fdfbf7' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#d4af37' }}></div> Navy & Gold
                </div>
                <div style={{ fontSize: '0.85rem', color: '#8b836d', fontFamily: 'Outfit, sans-serif' }}>Elegant navy backgrounds with gold accents and Outfit typography.</div>
              </div>
              <div 
                onClick={() => setTheme('clinical-light')}
                style={{ 
                  border: theme === 'clinical-light' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', 
                  padding: '16px', borderRadius: '8px', cursor: 'pointer', background: '#ffffff', color: '#0f172a' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Roboto, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0ea5e9' }}></div> Clinical Light
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontFamily: 'Roboto, sans-serif' }}>High legibility light theme with Roboto typography for clinical environments.</div>
              </div>
              <div 
                onClick={() => setTheme('notion')}
                style={{ 
                  border: theme === 'notion' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', 
                  padding: '16px', borderRadius: '8px', cursor: 'pointer', background: '#191919' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ececec' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#333333' }}></div> Notion Minimal
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9b9b9b' }}>Flat gray panels, zero glassmorphism, clean borders.</div>
              </div>
            </div>
          </div>

          {/* Typography Panel */}
          <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header" style={{ borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)', paddingBottom: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title text-gradient">Typography</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div 
                onClick={() => setFont('inter')}
                className="glass-panel-hover"
                style={{ 
                  border: font === 'inter' ? '2px solid var(--accent-primary)' : '1px solid hsla(var(--border-color-hsl) / 0.5)', 
                  padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'hsla(var(--bg-panel-hover-hsl) / 0.3)' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>Inter (Default)</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Clean, modern sans-serif optimized for legibility.</div>
              </div>
              <div 
                onClick={() => setFont('raleway')}
                className="glass-panel-hover"
                style={{ 
                  border: font === 'raleway' ? '2px solid var(--accent-primary)' : '1px solid hsla(var(--border-color-hsl) / 0.5)', 
                  padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'hsla(var(--bg-panel-hover-hsl) / 0.3)' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Raleway, sans-serif', color: 'var(--text-primary)' }}>Raleway</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'Raleway, sans-serif' }}>Elegant, geometric sans-serif with distinct character.</div>
              </div>
              <div 
                onClick={() => setFont('montserrat')}
                className="glass-panel-hover"
                style={{ 
                  border: font === 'montserrat' ? '2px solid var(--accent-primary)' : '1px solid hsla(var(--border-color-hsl) / 0.5)', 
                  padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'hsla(var(--bg-panel-hover-hsl) / 0.3)' 
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Montserrat, sans-serif', color: 'var(--text-primary)' }}>Montserrat</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'Montserrat, sans-serif' }}>Geometric sans-serif inspired by urban typography.</div>
              </div>
            </div>
          </div>

          {/* Developer / Mock Mode Panel */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title text-gradient">Developer</h3>
              <FlaskConical size={20} className="text-muted" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>Mock Mode</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Whether this build is pointed at a chain+oracle seeded with real test agents/markets for UI testing.
                  Set via <code style={{ color: 'var(--primary)' }}>VITE_MOCK_MODE</code> in <code style={{ color: 'var(--primary)' }}>.env</code> (build-time — this
                  can't be a live toggle, since seeding requires the protocol funder's private key, which must never
                  reach the browser).
                </div>
              </div>
              <span className={`badge ${MOCK_MODE ? 'badge-success' : 'badge-warning'}`}>{MOCK_MODE ? 'ON' : 'OFF'}</span>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Seed real test data (run outside the browser)
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'auto', whiteSpace: 'nowrap' }}>{SEED_COMMAND}</code>
                <button
                  className="btn btn-secondary"
                  style={{ flexShrink: 0 }}
                  onClick={() => { navigator.clipboard.writeText(SEED_COMMAND); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Modes Panel */}
          <div className="card">
            <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Privacy Modes <SeededDataBadge label="Not wired to a real setting" /></h3>
              <Lock size={20} className="text-muted" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Globe size={16} className="text-brand" /> Public Transparent</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>All agent reasoning traces and network calls are published to IPFS.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" className="checkbox-custom" />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={16} className="text-warning" /> HIPAA Compliant Enclave</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data egress is strictly gated. Internal memory is wiped after execution.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" className="checkbox-custom" defaultChecked />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={16} className="text-secondary" /> Local Knowledge Isolation</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vectors and embeddings are stored purely locally. No cloud sync.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" className="checkbox-custom" />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Dev API Keys Panel */}
          <div className="card">
            <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Developer API Keys</h3>
              <Key size={20} className="text-muted" />
            </div>

            {!authed ? (
              <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Authenticate with the User API to manage your developer keys and agent resources.
                </p>
                {authError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{authError}</div>}
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="Email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary flex-1 justify-center">
                    {isRegistering ? 'Register' : 'Log In'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary flex-1 justify-center" 
                    onClick={() => setIsRegistering(!isRegistering)}
                  >
                    {isRegistering ? 'Need to Log In?' : 'Need to Register?'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    Manage your API keys for authenticating with the Xibalba SDK.
                  </p>
                  <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Log Out
                  </button>
                </div>

                {newKey && (
                  <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--success)', marginBottom: '4px', fontSize: '0.85rem' }}>
                      Secret Key Generated (Copy now, it won't be shown again):
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="text" className="input-field" value={newKey} readOnly style={{ flex: 1 }} />
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => navigator.clipboard.writeText(newKey)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                  {loadingKeys && <div style={{ color: 'var(--text-muted)' }}>Loading keys...</div>}
                  {!loadingKeys && keys.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No API keys found.</div>}
                  {keys.map(k => (
                    <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          ID: {k.id.slice(0, 8)}... (Ceiling: {k.ais_trust_ceiling})
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Created: {new Date(k.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        {k.revoked_at ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Revoked</span>
                        ) : (
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleRevokeKey(k.id)} 
                            style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'var(--danger)', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn btn-primary w-full justify-center" onClick={handleGenerateKey}>
                  <Terminal size={16} /> Generate New Key Pair
                </button>
              </div>
            )}
          </div>
          
          {/* Network Settings */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Network & RPC Configuration <SeededDataBadge label={`Actual config: VITE_ORACLE_URL / VITE_CHAIN_ID in .env`} /></h3>
            </div>
            
            <div className="grid grid-2">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Base L2 RPC URL</label>
                <input type="text" className="input-field" defaultValue="https://mainnet.base.org" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Xibalba Oracle WSS Endpoint</label>
                <input type="text" className="input-field" defaultValue="wss://oracle.xibalba.com/v1/stream" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-primary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Not implemented -- this panel is display-only, see the Seeded Data badge above">Save Network Settings</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
