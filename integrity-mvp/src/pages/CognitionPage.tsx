import { BrainCircuit, Cpu, Zap, GitCommit } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { SandboxConsole } from '../components/SandboxConsole';

const INTENT_DATA = [
  { time: '10:00', total: 45, hashed: 45 },
  { time: '10:05', total: 52, hashed: 52 },
  { time: '10:10', total: 38, hashed: 38 },
  { time: '10:15', total: 65, hashed: 65 },
  { time: '10:20', total: 89, hashed: 89 },
  { time: '10:25', total: 72, hashed: 72 },
  { time: '10:30', total: 94, hashed: 94 }
];

export const CognitionPage = () => {
  return (
    <div className="main-content">
      <TopBar title="Cognition & Intent Cryptography">
        <SeededDataBadge />
      </TopBar>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={24} style={{ color: '#60a5fa' }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>LLM Routing Layer</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Engine</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>GPT-4o (OpenAI)</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fallback Engine</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Claude 3.5 Sonnet</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zero-Knowledge Prover</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Local Nitro Enclave</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitCommit size={24} style={{ color: '#10b981' }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>Intent Commitments</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Commitments</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>24</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Avg Generation Latency</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>45<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cryptographic Hash</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>SHA256+ECDSA</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrainCircuit size={24} style={{ color: '#a855f7' }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>Memory & Context</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Context Window</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>84k / 128k</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Vector DB Recall</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a855f7' }}>99.2%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tool Call Success</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>98.9%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="panel-header">
            <div>
              <h3 className="card-title">Cryptographic Intent Throughput</h3>
              <p className="panel-subtitle">Volume of agent reasoning chains successfully hashed and signed for pre-execution evaluation.</p>
            </div>
            <Zap size={20} className="text-brand" />
          </div>
          <div style={{ height: '300px', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INTENT_DATA}>
                <defs>
                  <linearGradient id="colorIntents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="hashed" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorIntents)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div style={{ marginTop: '24px' }}>
          <SandboxConsole />
        </div>
      </div>
    </div>
  );
};
