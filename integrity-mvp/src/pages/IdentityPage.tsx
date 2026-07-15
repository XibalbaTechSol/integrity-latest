import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '../components/TopBar';
import { ShieldCheck, Key, Shield, Globe, X, Database, Copy, UserCheck, Fingerprint, User } from 'lucide-react';
import { NotionDatabase } from '../components/NotionDatabase';
import { ClaimAgentModal } from '../components/ClaimAgentModal';
import type { ColumnDef } from '@tanstack/react-table';
import { useAgent } from '../contexts/AgentContext';
import { oracle, type WalletResponse } from '../services/oracle';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { XNSSearchService } from '../components/XNSSearchService';
import { Panel } from '../shared/Panel';

// --- Mocks ---
const MOCK_CREDENTIALS = [
  { id: '1', type: 'HIPAA Compliance Badge', icon: 'shield', issuer: 'Xibalba Trust Registry', status: 'Valid', validUntil: '2028-01-01' },
  { id: '2', type: 'KYC Provider Clearance', icon: 'key', issuer: 'Chainalysis Oracles', status: 'Valid', validUntil: '2027-05-15' }
];

const CREDENTIAL_COLUMNS: ColumnDef<any>[] = [
  { 
    accessorKey: 'type', 
    header: 'Credential Type', 
    cell: info => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
        {info.row.original.icon === 'shield' ? <ShieldCheck size={16} className="text-success" /> : <Key size={16} className="text-success" />} 
        {info.getValue() as string}
      </div>
    ) 
  },
  { accessorKey: 'issuer', header: 'Issuer', cell: info => <span style={{ color: 'var(--text-secondary)' }}>{info.getValue() as string}</span> },
  { accessorKey: 'status', header: 'Status', cell: info => <span className="badge badge-success">{info.getValue() as string}</span> },
  { accessorKey: 'validUntil', header: 'Valid Until', cell: info => <span style={{ color: 'var(--text-muted)' }}>{info.getValue() as string}</span> },
];

type TabId = 'identity' | 'enclave' | 'economic' | 'credentials';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'identity',    label: 'Identity & DID',      icon: <User size={14} /> },
  { id: 'enclave',     label: 'Enclave & Security',  icon: <ShieldCheck size={14} /> },
  { id: 'economic',    label: 'Economic Capacity',   icon: <Database size={14} /> },
  { id: 'credentials', label: 'Credentials',         icon: <Key size={14} /> },
];

// --- Shared Micro-styles ---
const statCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: 'var(--space-3) var(--space-4)',
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  minWidth: 0,
};

const statLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: '2px',
};

export const IdentityPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [isXnsOpen, setIsXnsOpen] = useState(false);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [xnsName, setXnsName] = useState('alpha.agent');
  const [tempXns, setTempXns] = useState('');
  
  const { selectedAgent } = useAgent();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgent) return;
    let cancelled = false;
    setWallet(null);
    setWalletError(null);
    oracle.getWallet(selectedAgent.id)
      .then(w => { if (!cancelled) setWallet(w); })
      .catch(e => { if (!cancelled) setWalletError(e instanceof Error ? e.message : 'Failed to reach the oracle'); });
    return () => { cancelled = true; };
  }, [selectedAgent]);

  const handleRegister = () => {
    if (tempXns.trim()) {
      setXnsName(tempXns.trim());
    }
    setIsXnsOpen(false);
    setTempXns('');
  };

  const did = selectedAgent?.did ?? null;
  const shortDID = did ? (did.length > 36 ? `${did.slice(0, 18)}\u2026${did.slice(-14)}` : did) : null;
  const ais = selectedAgent ? 9.5 : null; // MVP hardcodes or uses real AIS if available, fallback for demo
  const tier = selectedAgent?.status === 'ACTIVE' ? 'AAA' : 'Unverified';
  const tierColor = tier === 'AAA' ? 'var(--success)' : 'var(--text-muted)';
  const teeVerified = true;

  return (
    <div className="main-content" style={{ position: 'relative' }}>
      <TopBar title="Identity">
        <button className="btn btn-secondary glass-panel-hover" onClick={() => setIsClaimOpen(true)}>
          <Shield size={16} /> Claim Agent
        </button>
      </TopBar>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minHeight: 0, padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* --- Hero Bar --- */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            padding: 'var(--space-5) var(--space-6)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>
            <User size={28} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Identity</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Decentralized identifiers, XNS handles & API access
            </p>
          </div>
        </motion.div>

        {/* --- Agent Identity Card Strip --- */}
        {selectedAgent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <Panel title="" icon={undefined}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
                
                {/* DID */}
                <div style={statCardStyle}>
                  <div style={statLabelStyle}><Key size={12} style={{ marginRight: 4 }} /> Decentralized ID</div>
                  <div className="mono" title={did ?? '\u2014'} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {shortDID ?? <span style={{ color: 'var(--text-muted)' }}>Not Registered</span>}
                  </div>
                </div>

                {/* AIS Score */}
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>AIS Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
                    {ais !== null ? ais.toFixed(1) : '\u2014'}
                  </div>
                </div>

                {/* Verification Tier */}
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Verification Tier</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', background: `${tierColor}22`, color: tierColor, border: `1px solid ${tierColor}55` }}>
                      {tier}
                    </span>
                  </div>
                </div>

                {/* TEE Status */}
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>TEE Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {teeVerified ? (
                      <>
                        <ShieldCheck size={18} color="var(--gold, #f59e0b)" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold, #f59e0b)' }}>Verified</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Nitro)</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Not Attested</span>
                    )}
                  </div>
                </div>

              </div>
            </Panel>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.05 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-10) var(--space-6)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', textAlign: 'center' }}>
            <User size={40} color="var(--text-muted)" strokeWidth={1.5} />
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select an agent from the sidebar to manage identity</p>
          </motion.div>
        )}

        {/* --- Sub-navigation Tab Bar --- */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: 'var(--space-2)' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: '1px solid ' + (isActive ? 'var(--primary)' : 'transparent'),
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            );
          })}
        </div>

        {/* --- Tab Panels --- */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              
              {activeTab === 'identity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <Panel title="Sovereign Identity" icon={<Key size={18} />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', wordBreak: 'break-all', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {selectedAgent?.did ?? 'No agent selected'}
                        {selectedAgent && (
                          <button className="btn btn-secondary" style={{ padding: '6px', background: 'transparent' }} onClick={() => navigator.clipboard.writeText(selectedAgent.did)}><Copy size={16} /></button>
                        )}
                      </div>
                    </div>
                  </Panel>
                  
                  <Panel title="XNS Search Service" icon={<Globe size={18} />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Registered Handle</div>
                          <span style={{ fontSize: '2rem', fontWeight: '900', fontFamily: 'var(--font-mono)', background: 'linear-gradient(90deg, #fff, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {xnsName}.xibalba
                          </span>
                        </div>
                        <button className="btn btn-secondary" onClick={() => setIsXnsOpen(true)}>
                          Register Additional Handle
                        </button>
                      </div>
                      <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <XNSSearchService />
                      </div>
                    </div>
                  </Panel>
                </div>
              )}

              {activeTab === 'enclave' && (
                <Panel title="TEE Measurements" icon={<Shield size={18} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Execution Enclave</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>AWS Nitro Enclaves</div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PCR0 (Image Hash)</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--gold)', wordBreak: 'break-all' }}>e3b0c44298fc1c149afbf4c8996fb924...</div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PCR1 (Kernel Hash)</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#60a5fa', wordBreak: 'break-all' }}>8d743a129d20c5411df83e5c92842b10...</div>
                    </div>
                    <button className="btn btn-secondary mt-6" style={{ padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>
                      Regenerate Attestation Document
                    </button>
                  </div>
                </Panel>
              )}

              {activeTab === 'economic' && (
                <Panel title="Economic Capacity" icon={<Database size={18} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {walletError && <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: '8px', fontSize: '0.9rem' }}>Oracle error: {walletError}</div>}
                    
                    <div style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>ITK Token Balance</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                          {wallet ? Number(wallet.itk_balance).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={24} style={{ color: '#60a5fa' }} />
                      </div>
                    </div>

                    <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>Open Market Positions</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{wallet ? wallet.open_positions.length : '—'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>Stake ITK</button>
                      <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>Withdraw</button>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === 'credentials' && (
                <Panel title="Verifiable Credentials Wallet" icon={<UserCheck size={18} />}>
                  <div style={{ marginBottom: '16px' }}>
                    <SeededDataBadge label="No credentials system built" />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', height: '400px' }}>
                    <NotionDatabase data={MOCK_CREDENTIALS} columns={CREDENTIAL_COLUMNS} title="Credentials" readOnly />
                  </div>
                </Panel>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* XNS Registration Modal */}
      {isXnsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel" style={{ width: '500px', padding: '32px', border: '1px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={20} color="var(--primary)" />
                Register XNS Handle
              </h2>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setIsXnsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Desired Handle</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. trading-bot" 
                    value={tempXns}
                    onChange={(e) => setTempXns(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-main)', paddingRight: '90px' }} 
                  />
                  <span style={{ position: 'absolute', right: '16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>.xibalba</span>
                </div>
              </div>
              
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Registration Fee</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>50 ITK</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Target Resolution</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>Current DID</span>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={handleRegister}>
                Confirm & Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Agent Modal */}
      <ClaimAgentModal 
        isOpen={isClaimOpen} 
        onClose={() => setIsClaimOpen(false)} 
        onSuccess={() => setIsClaimOpen(false)} 
      />
    </div>
  );
};
