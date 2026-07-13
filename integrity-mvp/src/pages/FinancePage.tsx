import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { DollarSign, TrendingUp, Lock, ShoppingCart, Wallet, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { ActuarialHub } from '../components/ActuarialHub';
import { useAgent } from '../contexts/AgentContext';
import { oracle } from '../services/oracle';
import { SeededDataBadge } from '../shared/SeededDataBadge';

const stabilityData = [
  { day: 'Mon', stable: 85 },
  { day: 'Tue', stable: 88 },
  { day: 'Wed', stable: 82 },
  { day: 'Thu', stable: 90 },
  { day: 'Fri', stable: 92 },
  { day: 'Sat', stable: 89 },
  { day: 'Sun', stable: 88 },
];

export const FinancePage = () => {
  const [activeTab, setActiveTab] = useState<'treasury' | 'markets' | 'stability'>('treasury');
  const { selectedAgent } = useAgent();
  const [itkBalance, setItkBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgent) return;
    let cancelled = false;
    oracle.getWallet(selectedAgent.id).then(w => { if (!cancelled) setItkBalance(w.itk_balance); }).catch(() => { if (!cancelled) setItkBalance(null); });
    return () => { cancelled = true; };
  }, [selectedAgent]);

  return (
    <div className="main-content">
      <TopBar title="ITK Network Treasury & Economic Security" />
      
      <div style={{ padding: '0 24px', display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', flexShrink: 0 }}>
        {[
          { id: 'treasury', label: 'Treasury & Network Health' },
          { id: 'markets', label: 'A2A Markets & Escrow' },
          { id: 'stability', label: 'Stability & Certification' }
        ].map(tab => (
          <div 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ 
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab.id ? 600 : 400
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
        
        {activeTab === 'treasury' && (
          <>
            {/* Top 4 Stats — no network-wide treasury aggregation endpoint exists yet */}
            <div style={{ marginBottom: '12px' }}><SeededDataBadge label="No treasury aggregation endpoint yet" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Base L2 Escrow (TVL)', value: '$12,458,789.21', icon: <DollarSign />, change: '+4.21%', changeColor: 'var(--success)' },
            { label: 'Total Staked ITK', value: '12,987,354 ITK', icon: <Lock />, change: '+6.18%', changeColor: 'var(--success)' },
            { label: 'BCC Slashing Volume', value: '42,500 ITK', icon: <TrendingUp />, change: '-1.2%', changeColor: 'var(--success)' },
            { label: 'ITK Network Velocity', value: '$8.5M', icon: <ShoppingCart />, change: '+12.5%', changeColor: 'var(--success)' }
          ].map((stat, i) => (
            <div key={i} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ padding: '8px', background: 'var(--accent-primary-dim, rgba(59, 130, 246, 0.1))', color: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)' }}>
                  {stat.icon}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: stat.changeColor, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                  {stat.change}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          
          {/* Token Wallet */}
          <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Wallet size={18} /> Token Wallet
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {[
                { token: 'ITK', amount: itkBalance ? Number(itkBalance).toLocaleString() : '—', usd: null, color: 'var(--color-brand-primary)', real: true },
              ].map((asset, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: asset.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: '0.7rem' }}>
                      {asset.token}
                    </div>
                    <span style={{ fontWeight: 600 }}>{asset.token}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{asset.amount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{asset.usd}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }}>Deposit</button>
              <button className="btn btn-outline" style={{ flex: 1 }}>Withdraw</button>
              <button className="btn btn-outline" style={{ flex: 1 }}>Swap</button>
            </div>
          </div>

          {/* Network Health Index */}
          <div className="card">
             <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BarChart2 size={18} /> Network Integrity Health (BCC) <SeededDataBadge />
            </h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consensus State</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>99.9% Secure</div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>7-day block finality</div>
            </div>

            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stabilityData}>
                  <defs>
                    <linearGradient id="colorStability" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[70, 100]} hide />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)' }} />
                  <Area type="monotone" dataKey="stable" stroke="var(--success)" fillOpacity={1} fill="url(#colorStability)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
        </>
        )}

        {activeTab === 'markets' && <ActuarialHub mode="markets" />}
        {activeTab === 'stability' && <ActuarialHub mode="stability" />}

      </div>
    </div>
  );
};
