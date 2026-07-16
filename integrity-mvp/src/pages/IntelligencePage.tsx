import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { Activity, Brain, Zap, TrendingUp, GitBranch, Trophy, Cpu, GitCommit, BrainCircuit } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { oracle, type LeaderboardEntryDto } from '../services/oracle';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { SandboxConsole } from '../components/SandboxConsole';
import { useOracleStream } from '../hooks/useOracleStream';

const INTENT_DATA = [
  { time: '10:00', total: 45, hashed: 45 },
  { time: '10:05', total: 52, hashed: 52 },
  { time: '10:10', total: 38, hashed: 38 },
  { time: '10:15', total: 65, hashed: 65 },
  { time: '10:20', total: 89, hashed: 89 },
  { time: '10:25', total: 72, hashed: 72 },
  { time: '10:30', total: 94, hashed: 94 }
];

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}

const LiveBadge = () => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 10px',
      background: 'rgba(34, 197, 94, 0.12)',
      border: '1px solid var(--success)',
      borderRadius: '999px',
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: 'var(--success)',
      textTransform: 'uppercase',
    }}
  >
    <span
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--success)',
        display: 'inline-block',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
    LIVE
  </span>
);

const StatCard = ({ label, value, icon, accent = 'var(--accent-primary)' }: StatCardProps) => (
  <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, padding: '16px' }}>
    <div
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        background: `color-mix(in srgb, ${accent} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: accent,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
          color: accent,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  </div>
);

const AIS_COMPONENT_LABELS: Record<string, string> = {
  entropy: 'Entropy',
  grounding: 'Grounding',
  sacrifice: 'Sacrifice',
  compliance: 'Compliance',
};

export const IntelligencePage = () => {
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [showCognition, setShowCognition] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // PRODUCTION_GAPS.md §7: this radar used to plot 8 fabricated dimensions
  // ("ZK Proving Speed", "Gas Efficiency", ...) for two fake named agents.
  // Real AIS components (entropy/grounding/sacrifice/compliance,
  // oracle.getAis()) were already being fetched elsewhere in the app --
  // wired here for the top 2 real leaderboard agents instead.
  const [radarData, setRadarData] = useState<{ subject: string; A: number; B: number }[]>([]);
  const [radarLabels, setRadarLabels] = useState<{ left: string; right: string } | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);

  // Real SSE stream (all agents) — see backend/src/stream.rs.
  const { events: liveEvents, connected: streamConnected } = useOracleStream(undefined, 40);

  useEffect(() => {
    let cancelled = false;
    oracle.getLeaderboard()
      .then(data => { if (!cancelled) setLeaderboard(data); })
      .catch(e => { if (!cancelled) setLeaderboardError(e instanceof Error ? e.message : 'Failed to reach the oracle'); })
      .finally(() => { if (!cancelled) setLeaderboardLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (leaderboard.length < 2) {
      setRadarData([]);
      setRadarLabels(null);
      return;
    }
    let cancelled = false;
    const left = leaderboard[0];
    const right = leaderboard[1];
    setRadarError(null);
    Promise.all([oracle.getAis(left.agent_id), oracle.getAis(right.agent_id)])
      .then(([leftAis, rightAis]) => {
        if (cancelled) return;
        const subjects = Object.keys(leftAis.components) as (keyof typeof leftAis.components)[];
        setRadarData(subjects.map((key) => ({
          subject: AIS_COMPONENT_LABELS[key] ?? key,
          A: leftAis.components[key],
          B: rightAis.components[key],
        })));
        setRadarLabels({ left: left.agent_id.slice(-8), right: right.agent_id.slice(-8) });
      })
      .catch((e) => { if (!cancelled) setRadarError(e instanceof Error ? e.message : 'Failed to fetch AIS components'); });
    return () => { cancelled = true; };
  }, [leaderboard]);

  const [isAddTelemetryOpen, setIsAddTelemetryOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [customFields, setCustomFields] = useState<any[]>(() => {
    const saved = localStorage.getItem('integrity_custom_telemetry');
    return saved ? JSON.parse(saved) : [
      { id: 'drift', label: 'Semantic Drift', value: '0.8%', active: true },
      { id: 'memory', label: 'Enclave Memory', value: '412 MB', active: true }
    ];
  });

  useEffect(() => {
    localStorage.setItem('integrity_custom_telemetry', JSON.stringify(customFields));
  }, [customFields]);

  const toggleCustomField = (id: string) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, active: !f.active } : f));
  };

  const handleAddTelemetry = () => {
    if (!newFieldName || !newFieldValue) return;
    const newId = 'custom_' + Math.random().toString(36).substring(2, 9);
    setCustomFields(prev => [...prev, { id: newId, label: newFieldName, value: newFieldValue, active: true }]);
    setNewFieldName('');
    setNewFieldValue('');
    setIsAddTelemetryOpen(false);
  };

  return (
    <div className="main-content">
      <TopBar title="Intelligence Command | TELEMETRY" />
      
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ── Hero Bar ────────────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)'
                  }}
                >
                  <Zap size={18} />
                </div>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Intelligence Command
                </h1>
                <LiveBadge />
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '48px' }}>
                Real-time telemetry, reasoning traces & trajectory analysis
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--success)' }}>
              <TrendingUp size={14} /> Oracle Engine v9.0.2 — Nominal
            </div>
          </div>
        </div>

        {/* ── Intelligence Customization Console Toolbar ── */}
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
              <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'telemetry', label: 'Telemetry Stream', state: showTelemetry, set: setShowTelemetry },
                { id: 'radar', label: 'Radar Graphs', state: showRadar, set: setShowRadar },
                { id: 'cognition', label: 'Cognition & Reasoning', state: showCognition, set: setShowCognition }
              ].map(module => (
                <button
                  key={module.id}
                  onClick={() => module.set(!module.state)}
                  style={{
                    padding: '6px 12px', borderRadius: '4px',
                    border: `1px solid ${module.state ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: module.state ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    color: module.state ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {module.state ? '✓ ' : '+ '} {module.label}
                </button>
              ))}

              {customFields.map(field => (
                <button
                  key={field.id}
                  onClick={() => toggleCustomField(field.id)}
                  style={{
                    padding: '6px 12px', borderRadius: '4px',
                    border: `1px solid ${field.active ? 'var(--warning)' : 'var(--border-color)'}`,
                    background: field.active ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    color: field.active ? 'var(--warning)' : 'var(--text-muted)',
                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {field.active ? '✓ ' : '+ '} {field.label}
                </button>
              ))}
            </div>
          </div>
          <button 
            className="btn" 
            onClick={() => setIsAddTelemetryOpen(true)}
            style={{ padding: '6px 12px', fontSize: '0.7rem', height: '28px', border: '1px dashed var(--border-color)', background: 'transparent', color: 'var(--text-secondary)' }}
          >
            + Add Custom Telemetry
          </button>
        </div>

        {/* ── Leaderboard (real oracle data) ─────────────────────────── */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} /> REPUTATION LEADERBOARD <LiveBadge />
          </h2>
          {leaderboardError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', wordBreak: 'break-word' }}>
              Could not reach the Integrity Oracle ({leaderboardError}).
            </div>
          )}
          {!leaderboardError && leaderboardLoading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading...</div>
          )}
          {!leaderboardError && !leaderboardLoading && leaderboard.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No agents have an on-chain reputation score yet.</div>
          )}
          {leaderboard.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div key={entry.agent_id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                  <span style={{ width: '24px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.agent_id}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{Math.round(Number(entry.effective_score))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Stat Strip ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Node Telemetry</span>
          <SeededDataBadge />
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <StatCard label="Active Nodes" value={142} icon={<Activity size={18} />} accent="var(--accent-primary)" />
          <StatCard label="Aggregate AIS" value="12,402" icon={<Brain size={18} />} accent="var(--warning)" />
          <StatCard label="Active Disputes" value={0} icon={<GitBranch size={18} />} accent="var(--success)" />
          {customFields.filter(f => f.active).map(f => (
            <StatCard key={f.id} label={f.label} value={f.value} icon={<Zap size={18} />} accent="var(--success)" />
          ))}
        </div>

        {/* ── Interactive Radar Section: real AIS components for the top 2 leaderboard agents ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))', gap: '24px' }}>
          {showRadar && (
            <div className="card" style={{ flex: '1 1 60%' }}>
              <h2 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} /> MULTI-DIMENSIONAL INTEGRITY RADAR
                {!radarLabels && !radarError && <SeededDataBadge label="Needs 2+ leaderboard agents" />}
              </h2>
              <div style={{ height: '300px' }}>
                {radarError ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center', padding: '0 16px' }}>
                    Could not fetch AIS components: {radarError}
                  </div>
                ) : !radarLabels ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '0 16px' }}>
                    Needs at least 2 agents on the leaderboard to compare real AIS components.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 1000]} tick={false} axisLine={false} />
                      <Radar name={`Agent …${radarLabels.left}`} dataKey="A" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.3} />
                      <Radar name={`Agent …${radarLabels.right}`} dataKey="B" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.3} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-primary)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Telemetry Log — real SSE stream, all agents */}
          {showTelemetry && (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                <Activity size={18} /> LIVE TELEMETRY STREAM
                {streamConnected ? <LiveBadge /> : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Connecting…</span>}
              </h2>
              <div style={{ flex: 1, background: 'var(--bg-main)', padding: '12px', borderRadius: '6px', marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', wordBreak: 'break-word', minHeight: '150px', maxHeight: '360px' }}>
                {liveEvents.length === 0 && (
                  <div style={{ opacity: 0.6, color: 'var(--text-muted)' }}>Awaiting real telemetry/OTLP activity from any agent…</div>
                )}
                {liveEvents.map((ev, i) => {
                  if (ev.type === 'TelemetryEvent') {
                    return (
                      <div key={i} style={{ color: ev.flagged ? 'var(--danger)' : 'var(--accent-primary)' }}>
                        [TELEMETRY] {ev.agent_id} | event {ev.event_id.slice(0, 8)} | {ev.flagged ? 'FLAGGED' : 'nominal'}
                      </div>
                    );
                  }
                  if (ev.type === 'OtelSpan') {
                    return (
                      <div key={i} style={{ color: 'var(--accent-primary)', opacity: 0.85 }}>
                        [OTLP-SPAN] {ev.agent_id} | {ev.name} | trace {ev.trace_id.slice(0, 8)}
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ color: 'var(--gold)' }}>
                      [AIS] {ev.agent_id} | score {ev.ais.toFixed(1)} | zk×{ev.zk_boost}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cognition & Reasoning Module */}
          {showCognition && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={24} style={{ color: '#60a5fa' }} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>LLM Routing Layer</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Engine</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>GPT-4o (OpenAI)</div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fallback Engine</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Claude 3.5 Sonnet</div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zero-Knowledge Prover</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Local Nitro Enclave</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GitCommit size={24} style={{ color: '#10b981' }} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Intent Commitments</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Commitments</span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>24</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Avg Generation Latency</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>45<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cryptographic Hash</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>SHA256+ECDSA</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BrainCircuit size={24} style={{ color: '#a855f7' }} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Memory & Context</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Context Window</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>84k / 128k</span>
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
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0 }}>Cryptographic Intent Throughput</h3>
                    <p className="panel-subtitle" style={{ margin: 0, marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Volume of agent reasoning chains successfully hashed and signed for pre-execution evaluation.</p>
                  </div>
                  <Zap size={20} color="var(--accent-primary)" />
                </div>
                <div style={{ height: '300px' }}>
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
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Area type="monotone" dataKey="hashed" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorIntents)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <SandboxConsole />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Telemetry Modal */}
      {isAddTelemetryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={() => setIsAddTelemetryOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>Add Custom Telemetry</h3>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Telemetry Label</label>
              <input type="text" className="input" placeholder="e.g. Enclave Temperature" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} style={{ width: '100%' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Metric Value / Output</label>
              <input type="text" className="input" placeholder="e.g. 42.5°C or 99.8%" value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)} style={{ width: '100%' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} onClick={() => setIsAddTelemetryOpen(false)}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: 'var(--accent-primary)', color: 'var(--text-primary)', border: 'none' }} onClick={handleAddTelemetry} disabled={!newFieldName || !newFieldValue}>Add Stream</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
