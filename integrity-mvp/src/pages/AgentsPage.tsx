import { Users, Activity, ShieldCheck, Database, Link, X, Terminal } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { useState, useMemo, useEffect } from 'react';
import { NotionDatabase } from '../components/NotionDatabase';
import { createColumnHelper } from '@tanstack/react-table';
import { oracle, type AgentSummary } from '../services/oracle';

interface AgentRow extends AgentSummary {
  ais: number | null;
}

const TIER_LABELS: Record<number, string> = { 0: 'UNVERIFIED', 1: 'SOVEREIGN', 2: 'LINKED', 3: 'INSTITUTIONAL' };

export const AgentsPage = () => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summaries = await oracle.listAgents();
        const withAis = await Promise.all(
          summaries.map(async (agent) => {
            const ais = await oracle.getAis(agent.id).then(r => r.ais).catch(() => null);
            return { ...agent, ais };
          }),
        );
        if (!cancelled) setAgents(withAis);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to reach the oracle');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const avgAis = useMemo(() => {
    const scored = agents.filter((a): a is AgentRow & { ais: number } => a.ais !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((sum, a) => sum + a.ais, 0) / scored.length);
  }, [agents]);

  // NotionDatabase Columns
  const columnHelper = createColumnHelper<AgentRow>();
  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: 'Identifier (DID)',
      cell: info => <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}><ShieldCheck size={16} color="var(--success)" />{info.getValue()}</div>,
      size: 320,
    }),
    columnHelper.accessor('verification_tier', {
      header: 'Verification Tier',
      cell: info => <span className={`badge ${info.getValue() >= 1 ? 'badge-success' : 'badge-warning'}`}>{TIER_LABELS[info.getValue()] ?? `TIER ${info.getValue()}`}</span>,
      size: 160,
    }),
    columnHelper.accessor('ais', {
      header: 'AIS Score',
      cell: info => {
        const v = info.getValue();
        return v === null
          ? <span style={{ color: 'var(--text-muted)' }}>—</span>
          : <span style={{ fontWeight: 600, color: v > 700 ? 'var(--success)' : 'var(--danger)' }}>{Math.round(v)}</span>;
      },
      size: 120,
    }),
    columnHelper.accessor('created_at', {
      header: 'Registered',
      cell: info => <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(info.getValue()).toLocaleDateString()}</span>,
      size: 150,
    }),
  ], [columnHelper]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      <TopBar title="Agent Fleet Management">
        {loadError && (
          <div style={{ padding: '6px 12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} /> <span><strong>Sync Failed:</strong> {loadError}</span>
          </div>
        )}
        <button 
          onClick={() => setIsClaimOpen(true)}
          style={{ background: 'hsla(var(--bg-panel-hsl) / 0.8)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'hsla(var(--bg-panel-hsl) / 1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'hsla(var(--bg-panel-hsl) / 0.8)'}
        >
          <Link size={14} /> Claim Agent
        </button>
        <button 
          onClick={() => setIsRegisterOpen(true)}
          style={{ background: 'var(--gold)', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Users size={14} /> Register Agent
        </button>
      </TopBar>

      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="grid grid-3 mb-6" style={{ flexShrink: 0, gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--gold)' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>Registered Agents</h3>
              <Database size={18} color="var(--gold)" opacity={0.8} />
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              {isLoading ? '—' : agents.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live from <code style={{color: 'var(--text-primary)'}}>GET /v1/agents</code></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--success)' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>Verified Agents</h3>
              <Activity size={18} color="var(--success)" opacity={0.8} />
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              {isLoading ? '—' : agents.filter(a => a.verification_tier >= 1).length}
              <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}> / {agents.length}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tier ≥ 1 (Sovereign+)</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-primary)' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>Avg Network AIS</h3>
              <ShieldCheck size={18} color="var(--accent-primary)" opacity={0.8} />
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              {avgAis ?? '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Across scored agents</div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <NotionDatabase
            title="Deployed Agents Database"
            data={agents}
            columns={columns}
            readOnly={true}
          />
        </div>
      </div>

      {/* Register Agent Modal */}
      {isRegisterOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel" style={{ width: '500px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Register New Agent</h2>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setIsRegisterOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Agent Name</label>
                <input type="text" className="input-field" placeholder="e.g. Clinical Auditor v3" style={{ width: '100%', background: 'var(--bg-main)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Operating Enclave</label>
                <select className="input-field" style={{ width: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
                  <option>AWS Nitro Enclave</option>
                  <option>Azure Confidential VM</option>
                  <option>GCP TDX</option>
                </select>
              </div>
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: '8px', display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Terminal size={20} color="var(--primary)" />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This will deploy the 5 Agent Primitives via <code style={{ color: 'var(--primary)' }}>AgentPrimitivesFactory.sol</code> on Base L2 and register the agent with the <code style={{ color: 'var(--primary)' }}>XibalbaAgentRegistry</code>.
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} onClick={() => setIsRegisterOpen(false)}>
                Deploy Primitives
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Agent Modal */}
      {isClaimOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel" style={{ width: '500px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Claim Existing Agent</h2>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setIsClaimOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Agent Contract Address (Base L2)</label>
                <input type="text" className="input-field" placeholder="0x..." style={{ width: '100%', background: 'var(--bg-main)' }} />
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '12px', marginTop: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Claiming an agent connects your dashboard to an already-deployed <code style={{ color: 'var(--primary)' }}>SovereignAgent</code> contract. You must hold the admin key.
                </div>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', padding: '12px', marginTop: '8px', background: 'white', color: 'black' }} onClick={() => setIsClaimOpen(false)}>
                Verify Identity & Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
