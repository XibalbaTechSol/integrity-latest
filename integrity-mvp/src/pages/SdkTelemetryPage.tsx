import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { Activity, Server, Database, Code } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { oracle, type TelemetryEventDetailDto } from '../services/oracle';
import { useState, useEffect, useMemo } from 'react';

// Actually AgentContext is in '../contexts/AgentContext'
import { useAgent as useAgentContext } from '../contexts/AgentContext';

interface VolumePoint {
  time: string;
  events: number;
  flagged: number;
  spans: number;
}

function formatBucketTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const SdkTelemetryPage = () => {
  const { selectedAgent } = useAgentContext();
  const [telemetry, setTelemetry] = useState<TelemetryEventDetailDto[]>([]);
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgent) return;
    setLoading(true);
    setError(null);

    Promise.all([
      oracle.getTelemetry(selectedAgent.id),
      oracle.getTelemetryVolume(selectedAgent.id, '15m'),
      oracle.getOtelVolume(selectedAgent.id, '15m'),
    ])
      .then(([events, telemetryVolume, otelVolume]) => {
        setTelemetry(events);

        const byBucket = new Map<string, VolumePoint>();
        for (const b of telemetryVolume) {
          byBucket.set(b.bucket_start, { time: formatBucketTime(b.bucket_start), events: b.count, flagged: b.flagged_count, spans: 0 });
        }
        for (const b of otelVolume) {
          const existing = byBucket.get(b.bucket_start);
          if (existing) existing.spans = b.span_count;
          else byBucket.set(b.bucket_start, { time: formatBucketTime(b.bucket_start), events: 0, flagged: 0, spans: b.span_count });
        }
        setVolume(Array.from(byBucket.values()).sort((a, b) => a.time.localeCompare(b.time)));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch telemetry');
        setLoading(false);
      });
  }, [selectedAgent]);

  const hasVolumeData = useMemo(() => volume.some(v => v.events > 0 || v.spans > 0), [volume]);

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
            <h2 className="panel-title">
              Telemetry & Span Volume (15m buckets)
              {!selectedAgent && <SeededDataBadge label="Select an agent to load real data" />}
            </h2>
            <div style={{ height: '300px', marginTop: '24px' }}>
              {selectedAgent && !loading && !hasVolumeData ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No telemetry or OTLP volume recorded for this agent yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volume}>
                    <defs>
                      <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSpans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} />
                    <Legend />
                    <Area type="monotone" dataKey="events" name="Telemetry events" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorEvents)" />
                    <Area type="monotone" dataKey="flagged" name="Flagged" stroke="var(--danger)" fillOpacity={1} fill="url(#colorFlagged)" />
                    <Area type="monotone" dataKey="spans" name="OTLP spans" stroke="var(--gold)" fillOpacity={1} fill="url(#colorSpans)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
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
                <div key={event.id || idx} style={{ borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
