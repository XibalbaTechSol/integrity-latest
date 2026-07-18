import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { XCircle, ShieldCheck, Clock, Activity, Code, Zap, Pause, Play, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TraceNode, type TraceNodeType } from '../components/TraceNode';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { TraceAnalysisPanel } from '../components/TraceAnalysisPanel';
import { CompareTracesPanel } from '../components/traces/CompareTracesPanel';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant, type Edge, type Node, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { oracle, type SpanTreeNode } from '../services/oracle';
import { useOracleStream } from '../hooks/useOracleStream';
import { useAgent } from '../contexts/AgentContext';

const LATENCY_METRICS = [
  { time: '10:00', avg: 120, max: 250 },
  { time: '10:05', avg: 135, max: 280 },
  { time: '10:10', avg: 110, max: 210 },
  { time: '10:15', avg: 145, max: 320 },
  { time: '10:20', avg: 130, max: 290 },
  { time: '10:25', avg: 125, max: 240 },
  { time: '10:30', avg: 115, max: 220 },
];

const TOKEN_METRICS = [
  { agent: 'Healthcare', prompt: 45000, completion: 12000 },
  { agent: 'DeFi Bot', prompt: 21000, completion: 8500 },
  { agent: 'Auditor', prompt: 34000, completion: 5200 },
  { agent: 'Summarizer', prompt: 62000, completion: 24000 },
];

const nodeTypes = { traceNode: TraceNode };

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 280;
  const nodeHeight = 100;

  dagreGraph.setGraph({ rankdir: direction, ranksep: 120, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

/** Maps a real span's status/position in the tree to the same visual vocabulary TraceNode already uses. */
function spanNodeType(span: SpanTreeNode, isRoot: boolean): TraceNodeType {
  if (isRoot) return 'root';
  if (span.status_code === 'STATUS_CODE_ERROR') return 'danger';
  if (span.status_code === 'STATUS_CODE_OK') return 'success';
  return 'process';
}

/** Flattens the real nested span tree (from GET /v1/traces/{trace_id}) into ReactFlow nodes/edges. */
function treeToFlow(roots: SpanTreeNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function visit(span: SpanTreeNode, isRoot: boolean) {
    nodes.push({
      id: span.span_id,
      type: 'traceNode',
      position: { x: 0, y: 0 },
      data: { type: spanNodeType(span, isRoot), title: span.name, subtitle: `${span.duration_ms}ms · ${span.kind.replace('SPAN_KIND_', '')}` },
    });
    for (const child of span.children) {
      edges.push({
        id: `${span.span_id}-${child.span_id}`,
        source: span.span_id,
        target: child.span_id,
        animated: true,
        style: { stroke: child.status_code === 'STATUS_CODE_ERROR' ? 'var(--danger)' : 'var(--primary)', strokeWidth: 2 },
      });
      visit(child, false);
    }
  }

  roots.forEach((r) => visit(r, true));
  return { nodes, edges };
}

function formatStreamTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export const TraceAnalyticsPage = () => {
  const { selectedAgent } = useAgent();
  const [activeTab, setActiveTab] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceTree, setTraceTree] = useState<{ roots: SpanTreeNode[]; span_count: number; truncated: boolean } | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Real SSE stream (all agents) — see backend/src/stream.rs. Feeds the Live Stream
  // tab directly, and also contributes any trace freshly arriving during this
  // session to the Historical Traces list below.
  const { events, connected } = useOracleStream(selectedAgent?.id, 100);
  const displayedEvents = isLive ? events : events.slice(0, 0);

  // Historical trace discovery — GET /v1/agent/{id}/otel/traces (previously the ONLY
  // discovery mechanism was watching the live stream while a tab happened to be open,
  // so any trace generated earlier was permanently invisible despite being real data
  // already sitting in otel_spans; see backend::handlers::get_recent_traces).
  const [historicalTraces, setHistoricalTraces] = useState<Array<[string, string]>>([]);
  useEffect(() => {
    if (!selectedAgent) {
      setHistoricalTraces([]);
      return;
    }
    let cancelled = false;
    oracle
      .getRecentTraces(selectedAgent.id, 20)
      .then((rows) => {
        if (!cancelled) setHistoricalTraces(rows.map((r) => [r.trace_id, r.name]));
      })
      .catch(() => {
        if (!cancelled) setHistoricalTraces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAgent]);

  const recentTraceIds = useMemo(() => {
    const seen = new Map<string, string>(); // trace_id -> most recent span name
    for (const e of events) {
      if (e.type === 'OtelSpan' && (!selectedAgent || e.agent_id === selectedAgent.id)) {
        if (!seen.has(e.trace_id)) seen.set(e.trace_id, e.name);
      }
    }
    // Live-stream-discovered traces take precedence (most recent), then fill in
    // with the historical list for anything not already seen this session.
    for (const [traceId, name] of historicalTraces) {
      if (!seen.has(traceId)) seen.set(traceId, name);
    }
    return Array.from(seen.entries());
  }, [events, selectedAgent, historicalTraces]);

  useEffect(() => {
    if (!selectedTraceId && recentTraceIds.length > 0) {
      setSelectedTraceId(recentTraceIds[0][0]);
    }
  }, [recentTraceIds, selectedTraceId]);

  useEffect(() => {
    if (!selectedTraceId) return;
    let cancelled = false;
    setTraceError(null);
    oracle
      .getTraceTree(selectedTraceId)
      .then((tree) => {
        if (cancelled) return;
        setTraceTree(tree);
        const { nodes: flowNodes, edges: flowEdges } = treeToFlow(tree.roots);
        const layouted = getLayoutedElements(flowNodes, flowEdges, 'LR');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setActiveNodeId(flowNodes[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setTraceError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTraceId, setNodes, setEdges]);

  // Sync selected state for ReactFlow nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === activeNodeId,
      }))
    );
  }, [activeNodeId, setNodes]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setActiveNodeId(node.id);
  }, []);

  const flatSpans = useMemo(() => {
    const out: SpanTreeNode[] = [];
    function walk(s: SpanTreeNode) {
      out.push(s);
      s.children.forEach(walk);
    }
    traceTree?.roots.forEach(walk);
    return out;
  }, [traceTree]);
  const activeSpan = useMemo(() => flatSpans.find((s) => s.span_id === activeNodeId) ?? null, [flatSpans, activeNodeId]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Trace Analytics" />

      <div className="custom-scrollbar" style={{ padding: '0 24px', display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', overflowX: 'auto' }}>
        {['Live Stream', 'Historical Traces', 'Metrics', 'Time-Travel Debugger', 'Compare Traces'].map((tab, idx) => (
          <div
            key={tab}
            onClick={() => setActiveTab(idx)}
            style={{
              color: activeTab === idx ? 'white' : 'var(--text-secondary)',
              borderBottom: activeTab === idx ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === idx ? 600 : 400,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {tab}
            {(idx === 2 || idx === 3) && <SeededDataBadge />}
          </div>
        ))}
      </div>

      <div className="page-content" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', overflow: 'hidden', paddingTop: 0 }}>
        {/* Main Area */}
        <div className="card" style={{ flex: '1 1 70%', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.05) 0%, transparent 70%)', display: 'flex', flexDirection: 'column' }}>
          {/* TAB 0: LIVE STREAM — real SSE (/v1/stream) */}
          {activeTab === 0 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: connected ? 'var(--success)' : 'var(--warning)' }}>
                  {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                  <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {connected ? (isLive ? 'Live — real oracle event stream' : 'Connected, display paused') : 'Connecting…'}
                  </span>
                </div>

                <button className="btn btn-secondary glass-panel-hover" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }} onClick={() => setIsLive(!isLive)}>
                  {isLive ? <Pause size={14} /> : <Play size={14} />}
                  {isLive ? 'Pause' : 'Resume'}
                </button>
              </div>

              {displayedEvents.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '48px 0' }}>
                  No events yet — waiting for real telemetry/OTLP activity from any agent.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayedEvents.map((ev, i) => {
                  const isError = ev.type === 'TelemetryEvent' && ev.flagged;
                  const label = ev.type === 'TelemetryEvent' ? 'Telemetry ingested' : ev.type === 'OtelSpan' ? `Span: ${ev.name}` : `AIS updated: ${ev.ais.toFixed(1)}`;
                  const detail = ev.type === 'OtelSpan' ? ev.trace_id : ev.type === 'TelemetryEvent' ? (ev.flagged ? 'Flagged' : 'Clean') : `ZK boost ${ev.zk_boost}×`;
                  return (
                    <div key={`${ev.agent_id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ color: isError ? 'var(--danger)' : 'var(--success)' }}>{isError ? <XCircle size={20} /> : ev.type === 'AisUpdate' ? <Zap size={20} /> : <ShieldCheck size={20} />}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.agent_id}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', gap: '12px' }}>
                          <span>{label}</span>
                          <span>•</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{detail}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: isError ? 'var(--danger)' : 'var(--success)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', background: isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', display: 'inline-block' }}>{ev.type}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{'created_at' in ev ? formatStreamTime(ev.created_at) : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1: HISTORICAL TRACES — real GET /v1/traces/{trace_id} */}
          {activeTab === 1 && (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trace:</span>
                {recentTraceIds.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No traces observed yet this session — send real OTLP spans to see them here.</span>
                ) : (
                  <select value={selectedTraceId ?? ''} onChange={(e) => setSelectedTraceId(e.target.value)} className="input" style={{ fontSize: '0.8rem', padding: '4px 8px', maxWidth: '480px' }}>
                    {recentTraceIds.map(([id, name]) => (
                      <option key={id} value={id}>
                        {id.slice(0, 12)}… — {name}
                      </option>
                    ))}
                  </select>
                )}
                {traceTree && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {traceTree.span_count} spans{traceTree.truncated ? ' (truncated)' : ''}
                  </span>
                )}
              </div>
              {traceError ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: '0.85rem' }}>{traceError}</div>
              ) : nodes.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select a trace above to view its real span tree.</div>
              ) : (
                <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} fitView colorMode="dark" defaultEdgeOptions={{ type: 'smoothstep' }} proOptions={{ hideAttribution: true }}>
                  <Background color="var(--border-color)" variant={BackgroundVariant.Dots} />
                  <Controls style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fill: 'var(--text-muted)' }} />
                </ReactFlow>
              )}
            </div>
          )}

          {/* TAB 2: METRICS */}
          {activeTab === 2 && (
             <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>Network Inference Latency</h3>
                  <div style={{ height: '300px', background: 'var(--bg-main)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={LATENCY_METRICS}>
                        <defs>
                          <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorMax" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="max" stroke="var(--warning)" fillOpacity={1} fill="url(#colorMax)" name="Max Latency (ms)" />
                        <Area type="monotone" dataKey="avg" stroke="var(--primary)" fillOpacity={1} fill="url(#colorAvg)" name="Avg Latency (ms)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>Token Usage per Agent</h3>
                  <div style={{ height: '300px', background: 'var(--bg-main)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={TOKEN_METRICS}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="agent" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="prompt" stackId="a" fill="var(--primary)" name="Prompt Tokens" radius={[0, 0, 4, 4]} />
                        <Bar dataKey="completion" stackId="a" fill="var(--gold)" name="Completion Tokens" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             </div>
          )}

          {/* TAB 3: TRACE ANALYSIS PANEL */}
          {activeTab === 3 && (
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
                <TraceAnalysisPanel />
            </div>
          )}

          {/* TAB 4: COMPARE TRACES PANEL */}
          {activeTab === 4 && (
            <div style={{ flex: 1, padding: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <CompareTracesPanel />
            </div>
          )}

        </div>

        {/* Side Panel: Trace Details (Only shown for active tabs 1 and 3, not 4) */}
        {activeTab !== 4 && (
        <div className="card" style={{ flex: '1 1 30%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title" style={{ marginBottom: '24px' }}>Trace Details</h2>

          {activeSpan ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/> Duration</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{activeSpan.duration_ms}ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><Activity size={12} style={{ display: 'inline', marginRight: '4px' }}/> Kind</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{activeSpan.kind.replace('SPAN_KIND_', '')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }}/> Status</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: activeSpan.status_code === 'STATUS_CODE_ERROR' ? 'var(--danger)' : 'var(--success)' }}>{activeSpan.status_code.replace('STATUS_CODE_', '')}</span>
                </div>
              </div>

              <div style={{ marginTop: '16px', flex: 1 }}>
                <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Code size={14}/> Real Span Attributes</h3>
                <div style={{ background: '#0f111a', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #1f2937', height: '100%', minHeight: '250px' }}>
                  <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', wordBreak: 'break-word' }}>
                    {JSON.stringify({ span_id: activeSpan.span_id, agent_id: activeSpan.agent_id, attributes: activeSpan.attributes }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select a span node from the Historical Traces tab to see its real attributes here.</div>
          )}
        </div>
        )}

      </div>
    </div>
  );
};
