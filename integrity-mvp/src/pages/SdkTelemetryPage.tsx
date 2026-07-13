import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { Activity, Server, Database, Code } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { oracle } from '../services/oracle';
import { useState, useEffect } from 'react';

// Actually AgentContext is in '../contexts/AgentContext'
import { useAgent as useAgentContext } from '../contexts/AgentContext';

const timeSeriesData = [
  { time: '10:00', load: 45, latency: 120, throughput: 800 },
  { time: '10:05', load: 52, latency: 135, throughput: 850 },
  { time: '10:10', load: 48, latency: 110, throughput: 780 },
  { time: '10:15', load: 65, latency: 180, throughput: 950 },
  { time: '10:20', load: 78, latency: 210, throughput: 1100 },
  { time: '10:25', load: 55, latency: 140, throughput: 890 },
  { time: '10:30', load: 50, latency: 125, throughput: 820 }
];

export const SdkTelemetryPage = () => {
  const { selectedAgent } = useAgentContext();
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgent) return;
    setLoading(true);
    setError(null);
    oracle.getTelemetry(selectedAgent.id)
      .then(data => {
        setTelemetry(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch telemetry');
        setLoading(false);
      });
  }, [selectedAgent]);

  return (
    <div className="main-content">
      <TopBar title="SDK Telemetry & Ingestion">
        {selectedAgent && <span className="badge badge-primary">{selectedAgent.id}</span>}
      </TopBar>
      
      <div className="page-content">
        {/* Tri-Metric Display */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Oracle Link Status', value: selectedAgent ? 'Active' : 'No Agent Selected', icon: <Activity size={24} color={selectedAgent ? 'var(--success)' : 'var(--danger)'} />, border: selectedAgent ? 'var(--success)' : 'var(--danger)' },
            { label: 'Ingested Events Count', value: telemetry.length.toString(), icon: <Server size={24} color="var(--accent-primary)" />, border: 'var(--accent-primary)' },
            { label: 'Last Reported Nonce', value: telemetry.length > 0 ? `#${telemetry[0].nonce}` : '—', icon: <Database size={24} color="var(--gold)" />, border: 'var(--gold)' }
          ].map((metric, i) => (
            <div key={i} className="card" style={{ borderTop: `3px solid ${metric.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                  {metric.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metric.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          {/* Time Series Data */}
          <div className="card">
            <h2 className="panel-title">System Load & Latency (Time Series) <SeededDataBadge /></h2>
            <div style={{ height: '300px', marginTop: '24px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} />
                  <Area type="monotone" dataKey="load" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorLoad)" />
                  <Area type="monotone" dataKey="latency" stroke="var(--danger)" fillOpacity={1} fill="url(#colorLatency)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SDK Ingestion Feed */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={18} /> Live SDK Ingestion Feed
            </h2>
            <div style={{ 
              flex: 1, 
              background: '#0a0c10', 
              borderRadius: 'var(--radius-sm)', 
              padding: '16px', 
              marginTop: '16px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {loading && <div style={{ color: 'var(--text-muted)' }}>Loading telemetry history...</div>}
              {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
              {!loading && !error && telemetry.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>No telemetry events found for this agent.</div>
              )}
              {!loading && !error && telemetry.map((event, idx) => (
                <div key={event.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(event.created_at).toLocaleTimeString()}</span>
                    <span style={{ color: event.flagged ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                      [{event.flagged ? 'FLAGGED' : 'NOMINAL'}]
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    Nonce: #{event.nonce} | Variance: {event.performance_variance.toFixed(4)} | HGI: {event.hgi_raw.toFixed(4)} | GPU Hours: {event.gpu_hours_verified}
                  </div>
                  <details style={{ marginTop: '4px' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.7rem' }}>View Event Metadata</summary>
                    <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', fontSize: '0.7rem', overflow: 'auto', marginTop: '4px' }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
              <div style={{ color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                <span className="blinking-cursor">_</span> Awaiting incoming streams...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
