import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { ShieldCheck, Key, Shield, Globe, X, Database, Copy, UserCheck, Fingerprint } from 'lucide-react';
import { NotionDatabase } from '../components/NotionDatabase';
import { ClaimAgentModal } from '../components/ClaimAgentModal';
import type { ColumnDef } from '@tanstack/react-table';
import { useAgent } from '../contexts/AgentContext';
import { oracle, type WalletResponse } from '../services/oracle';
import { SeededDataBadge } from '../shared/SeededDataBadge';

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

export const IdentityPage = () => {
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

    // Unused state removed to fix strict linter errors

  return (
    <div className="main-content" style={{ position: 'relative' }}>
      <TopBar title="Agent Identity & Enclave Attestation">
        <button className="btn btn-secondary glass-panel-hover" onClick={() => setIsClaimOpen(true)}>
          <Shield size={16} /> Claim Agent
        </button>
        <button className="btn btn-secondary glass-panel-hover">
          <Key size={16} /> Rotate Keys
        </button>
        <button className="btn btn-primary glass-panel-hover">
          <UserCheck size={16} /> Request Credential
        </button>
      </TopBar>

      <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Top Header Card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(20,20,25,0.9) 0%, rgba(10,15,30,0.95) 100%)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                  <Fingerprint size={28} style={{ color: '#60a5fa' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #fff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Sovereign Identity
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Decentralized Identifier (DID)</div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', wordBreak: 'break-all', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {selectedAgent?.did ?? 'No agent selected'}
                {selectedAgent && (
                  <button className="btn btn-secondary" style={{ padding: '6px', background: 'transparent' }} onClick={() => navigator.clipboard.writeText(selectedAgent.did)}><Copy size={16} /></button>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Verification Status</div>
                <span className={`badge ${selectedAgent?.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '8px 16px', fontSize: '1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {selectedAgent?.status === 'ACTIVE' ? <><ShieldCheck size={16}/> Tier 1 Sovereign</> : 'Unverified'}
                </span>
              </div>
              <button className="btn btn-primary" onClick={() => setIsClaimOpen(true)} style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 600 }}>
                Claim New Agent
              </button>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                <Shield size={24} style={{ color: 'var(--gold)' }} /> TEE Measurements
              </h3>
              <SeededDataBadge label="Tier 3 attestation not built" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
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
            </div>
            <button className="btn btn-secondary mt-6" style={{ padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>
              Regenerate Attestation Document
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                <Database size={24} style={{ color: 'var(--primary)' }} /> Economic Capacity
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {walletError && <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: '8px', fontSize: '0.9rem' }}>Oracle error: {walletError}</div>}
              
              <div style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>ITK Token Balance</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
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
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>Stake ITK</button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>Withdraw</button>
            </div>
          </div>
        </div>
        
        <div style={{ background: 'linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(10,15,30,0.8) 100%)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
            pointerEvents: 'none'
          }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', margin: 0, color: 'white' }}>
                <Globe size={28} style={{ color: '#60a5fa' }} /> XNS (Xibalba Name Service)
              </h3>
              <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Global agent discovery and resolution protocol.</div>
            </div>
            <SeededDataBadge label="On-chain read not wired" />
          </div>
          
          <div style={{ display: 'flex', gap: '32px', alignItems: 'stretch', position: 'relative' }}>
            <div style={{ flex: 1, padding: '32px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Registered Handle</div>
               <span style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'var(--font-mono)', background: 'linear-gradient(90deg, #fff, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                 {xnsName}.xibalba
               </span>
               <div style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <ShieldCheck size={14} /> Resolving to Active DID
               </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                onClick={() => {}}
                style={{ flex: 1, background: 'var(--gold)', color: '#0a0e1a', border: 'none', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 10px 20px rgba(212, 175, 55, 0.15)', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } } as any}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Globe size={32} />
                  <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</div>
                </div>
                <div style={{ textAlign: 'left', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 4px 0' }}>Launch XNS Explorer</h4>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 500 }}>Search the global registry for other agents</div>
                </div>
              </button>
              
              <button className="btn btn-secondary" style={{ padding: '24px', fontSize: '1.1rem', fontWeight: 600, justifyContent: 'center', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setIsXnsOpen(true)}>
                Register Additional Handle
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={24} style={{ color: '#10b981' }} /> Verifiable Credentials Wallet <SeededDataBadge label="No credentials system built" />
          </h3>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '24px', overflow: 'hidden', height: '400px' }}>
            <NotionDatabase data={MOCK_CREDENTIALS} columns={CREDENTIAL_COLUMNS} title="Credentials" readOnly />
          </div>
        </div>
      </div>

      {/* XNS Registration Modal */}
      {isXnsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel" style={{ width: '500px', padding: '32px', border: '1px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
