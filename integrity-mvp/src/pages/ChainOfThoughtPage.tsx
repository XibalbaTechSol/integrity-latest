import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { XCircle, ShieldCheck, Clock, Activity, Code, Key, Pause, Play } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { TraceNode } from '../components/TraceNode';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { TraceAnalysisPanel } from '../components/TraceAnalysisPanel';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const INITIAL_STREAM = [
  { id: 'tx_9821', agent: 'Healthcare Navigator v2', status: 'SUCCESS', time: 'Just now', payload: 'ZK Proof Verified' },
  { id: 'tx_9820', agent: 'DeFi Arbitrage Bot', status: 'QUARANTINED', time: '2s ago', payload: 'Slippage > 5%' },
  { id: 'tx_9819', agent: 'Clinical Data Summarizer', status: 'SUCCESS', time: '12s ago', payload: 'HIPAA Context Active' },
  { id: 'tx_9818', agent: 'Healthcare Navigator v2', status: 'SUCCESS', time: '45s ago', payload: 'Telemetry Scanned' },
  { id: 'tx_9817', agent: 'Financial Auditor', status: 'BLOCKED', time: '1m ago', payload: 'Unauthorized Subnet' },
];

const GRAPH_NODES = [
  { id: 'node-1', type: 'root' as const, title: 'Root Inference', subtitle: 'Analyze patient telemetry.', x: 150, y: 200, to: ['node-2', 'node-3'], latency: '45ms', promptTokens: 420, compTokens: 80 },
  { id: 'node-2', type: 'danger' as const, title: 'Hypothesis Rejected', subtitle: 'Direct EHR query blocked by OPA.', x: 350, y: 100, to: [], latency: '120ms', promptTokens: 300, compTokens: 20 },
  { id: 'node-3', type: 'success' as const, title: 'Hypothesis Accepted', subtitle: 'Valid context path identified.', x: 350, y: 300, to: ['node-4'], latency: '85ms', promptTokens: 120, compTokens: 150 },
  { id: 'node-4', type: 'crypto' as const, title: 'ZK Proof Generation', subtitle: 'Compliance assertion generated.', x: 550, y: 200, to: ['node-5'], latency: '850ms', promptTokens: 0, compTokens: 0 },
  { id: 'node-5', type: 'process' as const, title: 'Final Output', subtitle: 'Response backed by crypto proof.', x: 750, y: 200, to: [], latency: '15ms', promptTokens: 50, compTokens: 120 }
];

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

const initialNodes: Node[] = [
  { id: 'node-1', type: 'traceNode', position: { x: 50, y: 200 }, data: { type: 'root', title: 'Root Inference', subtitle: 'Analyze patient telemetry.' } },
  { id: 'node-2', type: 'traceNode', position: { x: 350, y: 100 }, data: { type: 'danger', title: 'Hypothesis Rejected', subtitle: 'Direct EHR query blocked by OPA.' } },
  { id: 'node-3', type: 'traceNode', position: { x: 350, y: 300 }, data: { type: 'success', title: 'Hypothesis Accepted', subtitle: 'Valid context path identified.' } },
  { id: 'node-4', type: 'traceNode', position: { x: 650, y: 200 }, data: { type: 'crypto', title: 'ZK Proof Generation', subtitle: 'Compliance assertion generated.' } },
  { id: 'node-5', type: 'traceNode', position: { x: 950, y: 200 }, data: { type: 'process', title: 'Final Output', subtitle: 'Response backed by crypto proof.' } }
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: 'var(--danger)', strokeWidth: 2 } },
  { id: 'e1-3', source: 'node-1', target: 'node-3', animated: true, style: { stroke: 'var(--success)', strokeWidth: 2 } },
  { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true, style: { stroke: 'var(--gold)', strokeWidth: 2 } },
  { id: 'e4-5', source: 'node-4', target: 'node-5', animated: true, style: { stroke: 'var(--primary)', strokeWidth: 2 } }
];

export const ChainOfThoughtPage = () => {
  const [activeTab, setActiveTab] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeNodeId, setActiveNodeId] = useState<string>('node-1');
  const [stream, setStream] = useState(INITIAL_STREAM);
  const [isLive, setIsLive] = useState(true);

  // Sync selected state for ReactFlow nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === activeNodeId,
      }))
    );
  }, [activeNodeId, setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setActiveNodeId(node.id);
  }, []);
  const activeNode = useMemo(() => GRAPH_NODES.find(n => n.id === activeNodeId) || GRAPH_NODES[0], [activeNodeId]);

  // Simulate live stream
  useEffect(() => {
    if (activeTab === 0 && isLive) {
      const interval = setInterval(() => {
        setStream(prev => {
          const isSuccess = Math.random() > 0.3;
          const agents = ['Healthcare Navigator v2', 'DeFi Arbitrage Bot', 'Clinical Data Summarizer', 'Financial Auditor'];
          const payloads = isSuccess 
            ? ['ZK Proof Verified', 'HIPAA Context Active', 'Telemetry Scanned', 'Transaction Signed'] 
            : ['Slippage > 5%', 'Unauthorized Subnet', 'Signature Mismatch', 'OPA Policy Violation'];
          
          const newTx = { 
            id: `tx_${Math.floor(Math.random() * 10000)}`, 
            agent: agents[Math.floor(Math.random() * agents.length)], 
            status: isSuccess ? 'SUCCESS' : 'QUARANTINED', 
            time: 'Just now',
            payload: payloads[Math.floor(Math.random() * payloads.length)]
          };
          
          return [newTx, ...prev.map(p => ({...p, time: p.time.includes('ago') ? p.time : '2s ago'}))].slice(0, 15);
        });
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [activeTab, isLive]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="AI Chain of Thought Traces">
        <SeededDataBadge />
      </TopBar>
      
      <div style={{ padding: '0 24px', display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        {['Live Stream', 'Historical Traces', 'Metrics', 'Time-Travel Debugger'].map((tab, idx) => (
          <div 
            key={tab}
            onClick={() => setActiveTab(idx)}
            style={{ 
              color: activeTab === idx ? 'white' : 'var(--text-secondary)',
              borderBottom: activeTab === idx ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === idx ? 600 : 400
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="page-content" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', overflow: 'hidden', paddingTop: 0 }}>
        
        {/* Main Area */}
        <div className="card" style={{ flex: '1 1 70%', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.05) 0%, transparent 70%)', display: 'flex', flexDirection: 'column' }}>
          
          {/* TAB 0: LIVE STREAM */}
          {activeTab === 0 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isLive ? 'var(--success)' : 'var(--warning)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? 'var(--success)' : 'var(--warning)', animation: isLive ? 'pulse 2s infinite' : 'none' }}></div>
                  <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {isLive ? 'Listening to Network WebSocket' : 'Stream Paused'}
                  </span>
                </div>
                
                <button 
                  className="btn btn-secondary glass-panel-hover" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                  onClick={() => setIsLive(!isLive)}
                >
                  {isLive ? <Pause size={14} /> : <Play size={14} />}
                  {isLive ? 'Pause' : 'Resume'}
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stream.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', transition: 'all 0.3s ease' }}>
                    <div style={{ color: tx.status === 'SUCCESS' ? 'var(--success)' : 'var(--danger)' }}>
                      {tx.status === 'SUCCESS' ? <ShieldCheck size={20} /> : <XCircle size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 500 }}>{tx.agent}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', gap: '12px' }}>
                        <span>{tx.id}</span>
                        <span>•</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{tx.payload}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: tx.status === 'SUCCESS' ? 'var(--success)' : 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', background: tx.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', borderRadius: '4px', display: 'inline-block' }}>
                        {tx.status}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{tx.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: HISTORICAL TRACES (GRAPH) */}
          {activeTab === 1 && (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <ReactFlow 
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                colorMode="dark"
                defaultEdgeOptions={{ type: 'smoothstep' }}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="var(--border-color)" variant={BackgroundVariant.Dots} />
                <Controls style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fill: 'var(--text-muted)' }} />
              </ReactFlow>
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

        </div>

        {/* Side Panel: Trace Details */}
        <div className="card" style={{ flex: '1 1 30%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title" style={{ marginBottom: '24px' }}>Trace Details</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/> Node Latency</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{activeNode.latency}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><Activity size={12} style={{ display: 'inline', marginRight: '4px' }}/> Prompt Tokens</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{activeNode.promptTokens}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}><Activity size={12} style={{ display: 'inline', marginRight: '4px' }}/> Completion Tokens</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>{activeNode.compTokens}</span>
              </div>
            </div>

            {activeNode.type === 'crypto' && (
              <div style={{ background: 'rgba(212, 175, 55, 0.05)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gold)' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} /> Cryptographic Proof Valid
                </h3>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  0x8f2c...4b1e (Noir Circuit: HIPAA_v2)
                </div>
              </div>
            )}

            <div style={{ marginTop: '16px', flex: 1 }}>
              <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Code size={14}/> Raw Payload</h3>
              <div style={{ background: '#0f111a', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #1f2937', height: '100%', minHeight: '250px' }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', wordBreak: 'break-word' }}>
{activeNodeId === 'node-1' ? `{
  "context_id": "ctx_992",
  "action": "evaluate_telemetry",
  "enclave_assertion": true
}` : activeNodeId === 'node-2' ? `{
  "action": "query_ehr",
  "error": "OPA_POLICY_VIOLATION",
  "reason": "Direct EHR access requires 2FA token.",
  "severity": "CRITICAL"
}` : activeNodeId === 'node-3' ? `{
  "action": "synthesize_context",
  "data_sources": ["vital_signs", "lab_results"],
  "inference_confidence": 0.94
}` : activeNodeId === 'node-4' ? `{
  "circuit": "hipaa_compliance",
  "public_inputs": ["0x9a...", "0x2b..."],
  "proof_hash": "0x8f2c...4b1e",
  "verifier": "0xBaseL2Contract"
}` : `{
  "status": "PROCESSING_COMPLETE",
  "node_id": "${activeNodeId}",
  "output_hash": "0x1122...3344"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
