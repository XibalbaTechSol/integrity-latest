import { TopBar } from '../components/TopBar';
import { GitCompare, AlertCircle, ChevronDown, Clock, Code, Activity, XCircle } from 'lucide-react';
import { useState } from 'react';
import { SeededDataBadge } from '../shared/SeededDataBadge';

const TRACE_OPTIONS = [
  { id: '7c2a-9e8d', name: 'Identity Resolution (Stable)', duration: '45.35ms', errors: 0 },
  { id: 'b3f1-4a7c', name: 'Identity Resolution (Timeout)', duration: '130.48ms', errors: 1 },
  { id: 'f882-11x9', name: 'ZK Proof Generation', duration: '850.12ms', errors: 0 }
];

const TRACE_DATA: Record<string, any> = {
  '7c2a-9e8d': {
    id: '7c2a-9e8d', name: 'Identity Resolution (Stable)', duration: '45.35ms', errors: 0,
    spans: [
      { 
        id: 't1-s1', label: 'Authentication Service', offset: '0%', width: '100%', color: 'var(--primary)', dur: '45.35ms', 
        inputs: '{\n  "token": "eyJhbG...",\n  "method": "Bearer"\n}', outputs: '{\n  "userId": "usr_99x",\n  "status": "active"\n}',
        children: [
          { id: 't1-s1-1', label: 'Token Validation', offset: '5%', width: '90%', color: 'var(--primary)', dur: '40.10ms', inputs: '{"token": "eyJhbG..."}', outputs: '{"valid": true}' },
          { id: 't1-s1-2', label: 'User DB Lookup', offset: '10%', width: '30%', color: 'var(--primary)', dur: '12.40ms', inputs: '{"userId": "usr_99x"}', outputs: '{"role": "admin"}' }
        ]
      },
      { id: 't1-s2', label: 'Policy Check (OPA)', offset: '45%', width: '40%', color: 'var(--success)', dur: '18.05ms', inputs: '{"subject": "usr_99x", "action": "read_ehr"}', outputs: '{"allow": true}' },
      { id: 't1-s3', label: 'Response Serialization', offset: '90%', width: '10%', color: 'var(--primary)', dur: '4.20ms', inputs: '{"data": {"allow": true}}', outputs: '{"json": "{...}"}' },
    ],
    payload: `{\n  "did": "did:intg:0x7a2...f89c",\n  "action": "read_ehr",\n  "context": {\n    "ip": "192.168.1.1",\n    "enclave": "aws-nitro"\n  }\n}`
  },
  'b3f1-4a7c': {
    id: 'b3f1-4a7c', name: 'Identity Resolution (Timeout)', duration: '130.48ms', errors: 1,
    spans: [
      { 
        id: 't2-s1', label: 'Authentication Service', offset: '0%', width: '100%', color: 'var(--gold)', dur: '130.48ms',
        inputs: '{\n  "token": "eyJhbG...",\n  "method": "Bearer"\n}', outputs: '{\n  "error": "Timeout"\n}',
        children: [
          { id: 't2-s1-1', label: 'Token Validation', offset: '5%', width: '90%', color: 'var(--gold)', dur: '122.10ms', inputs: '{"token": "eyJhbG..."}', outputs: '{"valid": true}' },
          { 
            id: 't2-s1-2', label: 'User DB Lookup', offset: '10%', width: '60%', color: 'var(--danger)', error: true, dur: '85.40ms',
            inputs: '{"userId": "usr_99x"}', outputs: '{"error": "ConnectionTimeout"}',
            children: [
              { id: 't2-s1-2-1', label: 'DB Timeout Retry 1', offset: '30%', width: '40%', color: 'var(--danger)', dur: '45.00ms', inputs: '{"attempt": 1}', outputs: '{"error": "ConnectionTimeout"}' }
            ]
          },
        ]
      },
      { id: 't2-s2', label: 'Policy Check (OPA)', offset: '75%', width: '15%', color: 'var(--success)', dur: '18.15ms', inputs: '{"subject": "usr_99x", "action": "read_ehr"}', outputs: '{"allow": true}' },
      { id: 't2-s3', label: 'Response Serialization', offset: '90%', width: '10%', color: 'var(--gold)', dur: '4.50ms', inputs: '{"data": {"allow": true}}', outputs: '{"json": "{...}"}' },
    ],
    payload: `{\n  "did": "did:intg:0x7a2...f89c",\n  "action": "read_ehr",\n  "context": {\n    "ip": "203.0.113.42",\n    "enclave": "azure-cvm"\n  }\n}`
  },
  'f882-11x9': {
    id: 'f882-11x9', name: 'ZK Proof Generation', duration: '850.12ms', errors: 0,
    spans: [
      { 
        id: 't3-s1', label: 'ZKP Pipeline', offset: '0%', width: '100%', color: 'var(--success)', dur: '850.12ms',
        inputs: '{"circuit": "circ_09x21"}', outputs: '{"proof": "0x..."}',
        children: [
          { id: 't3-s1-1', label: 'Circuit Compilation', offset: '5%', width: '15%', color: 'var(--success)', dur: '120.00ms', inputs: '{"source": "..."}', outputs: '{"acir": "..."}' },
          { id: 't3-s1-2', label: 'Witness Generation', offset: '20%', width: '40%', color: 'var(--success)', dur: '340.50ms', inputs: '{"inputs": {...}}', outputs: '{"witness": "..."}' },
          { id: 't3-s1-3', label: 'Proof Generation', offset: '60%', width: '35%', color: 'var(--success)', dur: '300.20ms', inputs: '{"witness": "..."}', outputs: '{"pi_a": "..."}' },
        ]
      },
      { id: 't3-s2', label: 'Proof Verification', offset: '95%', width: '5%', color: 'var(--primary)', dur: '40.00ms', inputs: '{"proof": "..."}', outputs: '{"valid": true}' },
    ],
    payload: `{\n  "circuit_id": "circ_09x21",\n  "inputs": {\n    "secret": "***",\n    "public_hash": "0x5f22...1a99"\n  },\n  "verifier": "plonk"\n}`
  }
};

export const CompareTracesPage = () => {
  const [leftTraceId, setLeftTraceId] = useState(TRACE_OPTIONS[0].id);
  const [rightTraceId, setRightTraceId] = useState(TRACE_OPTIONS[1].id);
  const [activeTab, setActiveTab] = useState('Gantt Timeline');
  const [leftDropdownOpen, setLeftDropdownOpen] = useState(false);
  const [rightDropdownOpen, setRightDropdownOpen] = useState(false);
  const [expandedSpans, setExpandedSpans] = useState<Record<string, boolean>>({
    't1-s1': true,
    't2-s1': true,
    't2-s1-2': true,
    't3-s1': true
  });
  const [selectedSpan, setSelectedSpan] = useState<any>(null);

  const leftTrace = TRACE_DATA[leftTraceId];
  const rightTrace = TRACE_DATA[rightTraceId];

  const toggleSpan = (spanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSpans(prev => ({ ...prev, [spanId]: !prev[spanId] }));
  };

  const renderDropdown = (isOpen: boolean, onSelect: (id: string) => void, close: () => void) => {
    if (!isOpen) return null;
    return (
      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: 'var(--radius-md)', zIndex: 100, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        {TRACE_OPTIONS.map(opt => (
          <div 
            key={opt.id}
            style={{ padding: '12px', borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.3)', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onClick={() => { onSelect(opt.id); close(); }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsla(var(--bg-panel-hover-hsl) / 0.4)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{opt.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {opt.id} • {opt.duration}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderSpanTree = (spans: any[], depth = 0, colorCode: string) => {
    return spans.map((span) => {
      const isExpanded = expandedSpans[span.id];
      const hasChildren = span.children && span.children.length > 0;
      
      return (
        <div key={span.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="gantt-row" style={{ position: 'relative', cursor: 'pointer', marginLeft: `${depth * 12}px` }} onClick={() => setSelectedSpan(span)}>
            <div style={{ display: 'flex', marginLeft: span.offset, width: span.width, background: span.error ? 'rgba(244, 63, 94, 0.1)' : `rgba(${colorCode === 'var(--gold)' ? '212, 175, 55' : '59, 130, 246'}, 0.1)`, border: `1px solid ${span.color}`, padding: '6px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              {hasChildren && (
                <div onClick={(e) => toggleSpan(span.id, e)} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px' }}>
                  <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                </div>
              )}
              {span.error && <AlertCircle size={12} style={{ marginRight: '6px', marginTop: '1px' }} color="var(--danger)" />}
              {span.label}
              <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.65rem' }}>{span.dur}</span>
            </div>
          </div>
          {isExpanded && hasChildren && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {renderSpanTree(span.children, depth + 1, colorCode)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderTraceColumn = (trace: any, colorCode: string) => (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem', marginBottom: '16px', background: `rgba(${colorCode === 'var(--gold)' ? '212, 175, 55' : '59, 130, 246'}, 0.05)`, padding: '12px', borderRadius: '6px', borderLeft: `3px solid ${colorCode}` }}>
        <div><Clock size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-muted)' }}>Duration:</span> {trace.duration}</div>
        <div><AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-muted)' }}>Errors:</span> <span style={{ color: trace.errors > 0 ? 'var(--danger)' : 'var(--success)' }}>{trace.errors}</span></div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'Gantt Timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {renderSpanTree(trace.spans, 0, colorCode)}
          </div>
        )}

        {activeTab === 'JSON Payload Diff' && (
          <div style={{ padding: '16px', background: '#0f111a', borderRadius: '6px', border: '1px solid #1f2937', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Code size={14} /> Request Payload</h4>
            </div>
            <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {trace.payload}
            </pre>
          </div>
        )}

        {activeTab === 'Flame Graph' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <Activity size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>Flame graph rendering requires profiler extension.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        title="Compare Traces & Spans"
        tabs={['Gantt Timeline', 'JSON Payload Diff', 'Flame Graph']}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <SeededDataBadge />
      </TopBar>
      
      {/* Trace Selectors */}
      <div style={{ display: 'flex', gap: 'var(--space-6)', padding: '0 24px', marginBottom: '16px', marginTop: '16px' }}>
        <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
          <div 
            onClick={() => setLeftDropdownOpen(!leftDropdownOpen)}
            style={{ padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', flex: 1, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>Trace A</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{leftTrace.name} <span style={{ color: 'var(--text-muted)' }}>[{leftTrace.id}]</span></div>
            </div>
            <ChevronDown size={16} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
          </div>
          {renderDropdown(leftDropdownOpen, setLeftTraceId, () => setLeftDropdownOpen(false))}
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
          <div 
            onClick={() => setRightDropdownOpen(!rightDropdownOpen)}
            style={{ padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', flex: 1, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '2px' }}>Trace B</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{rightTrace.name} <span style={{ color: 'var(--text-muted)' }}>[{rightTrace.id}]</span></div>
            </div>
            <ChevronDown size={16} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
          </div>
          {renderDropdown(rightDropdownOpen, setRightTraceId, () => setRightDropdownOpen(false))}
        </div>
        
        {/* Difference Summary Panel Header */}
        <div style={{ flex: '0 0 250px' }}></div>
      </div>
      
      <div className="page-content" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', overflow: 'hidden', paddingTop: 0 }}>
        
        {/* Left Trace */}
        {renderTraceColumn(leftTrace, 'var(--primary)')}

        {/* Right Trace */}
        {renderTraceColumn(rightTrace, 'var(--gold)')}
        
        {/* Difference/Span Details Panel */}
        <div className="card" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column' }}>
          {selectedSpan ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Code size={18} /> Span Details
                </h2>
                <button onClick={() => setSelectedSpan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <XCircle size={16} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Operation</h4>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{selectedSpan.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Duration: {selectedSpan.dur}</div>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Inputs</h4>
                  <div style={{ background: '#0f111a', padding: '12px', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selectedSpan.inputs || 'No inputs recorded'}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Outputs</h4>
                  <div style={{ background: '#0f111a', padding: '12px', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: selectedSpan.error ? '#fca5a5' : '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selectedSpan.outputs || 'No outputs recorded'}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <GitCompare size={18} /> Deviations
              </h2>
              
              {(leftTraceId === '7c2a-9e8d' && rightTraceId === 'b3f1-4a7c') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  <div style={{ padding: '12px', borderLeft: '3px solid #f87171', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '0 4px 4px 0' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#fca5a5', marginBottom: '4px' }}>Critical Error</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Database Timeout observed in Trace B during User DB Lookup.</p>
                  </div>
                  <div style={{ padding: '12px', borderLeft: '3px solid #fbbf24', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '0 4px 4px 0' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#fcd34d', marginBottom: '4px' }}>Latency Spike</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>User DB Lookup is 73ms slower in Trace B (85.40ms vs 12.40ms).</p>
                  </div>
                  <div style={{ padding: '12px', borderLeft: '3px solid var(--primary)', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0 4px 4px 0' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#93c5fd', marginBottom: '4px' }}>Payload Drift</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Different IP Address and Enclave Type detected in inputs.</p>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '12px', background: 'var(--bg-main)', borderRadius: '4px' }}>
                  No significant deviations detected between these traces.
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
