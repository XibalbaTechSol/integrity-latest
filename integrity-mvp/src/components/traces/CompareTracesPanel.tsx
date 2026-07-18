import { GitCompare, AlertCircle, ChevronDown, Clock, Code, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { oracle, type SpanTreeNode, type TraceTreeResponse } from '../../services/oracle';
import { useOracleStream } from '../../hooks/useOracleStream';
import { useAgent } from '../../contexts/AgentContext';

/**
 * Real per-agent traces for the agent selected in the global TopBar selector
 * (AgentContext) -- this panel is scoped to that one agent, exactly like the
 * rest of Trace Analytics, rather than mixing every agent's traces together.
 *
 * Two real discovery sources, merged: (1) GET /v1/agent/{id}/otel/traces
 * (`oracle.getRecentTraces`) preloads the selected agent's recent traces
 * immediately on mount/agent-change, so both Trace A/B dropdowns have real
 * options right away instead of sitting empty until a live event happens to
 * arrive; (2) the agent-scoped SSE stream folds in any brand-new trace that
 * arrives while the panel is open. Each individual trace tree is then fetched
 * via GET /v1/traces/{trace_id} (`oracle.getTraceTree`). PRODUCTION_GAPS.md
 * §7/§12: this used to be hardcoded to 3 fake trace IDs, then live-stream-only
 * (unusable until an event landed); this is the real, agent-scoped version.
 */

interface GanttSpan {
  id: string;
  label: string;
  offset: string;
  width: string;
  color: string;
  dur: string;
  error: boolean;
  attributes: Record<string, unknown>;
  children: GanttSpan[];
}

function spanColor(span: SpanTreeNode, palette: string): string {
  if (span.status_code === 'STATUS_CODE_ERROR') return 'var(--danger)';
  if (span.status_code === 'STATUS_CODE_OK') return palette === 'primary' ? 'var(--primary)' : 'var(--gold)';
  return 'var(--text-muted)';
}

/** Converts a real span tree into the {offset, width} percentage shape the
 * Gantt renderer below expects, relative to the trace's own earliest start
 * time and total wall-clock span -- not fabricated, computed from real
 * start_time/end_time timestamps. */
function treeToGantt(roots: SpanTreeNode[], palette: string): { spans: GanttSpan[]; traceStartMs: number; traceDurationMs: number } {
  const allStarts = roots.length ? roots.flatMap(collectStarts) : [0];
  const allEnds = roots.length ? roots.flatMap(collectEnds) : [0];
  const traceStartMs = Math.min(...allStarts);
  const traceEndMs = Math.max(...allEnds);
  const traceDurationMs = Math.max(1, traceEndMs - traceStartMs);

  function collectStarts(s: SpanTreeNode): number[] {
    return [new Date(s.start_time).getTime(), ...s.children.flatMap(collectStarts)];
  }
  function collectEnds(s: SpanTreeNode): number[] {
    return [new Date(s.end_time).getTime(), ...s.children.flatMap(collectEnds)];
  }

  function convert(span: SpanTreeNode): GanttSpan {
    const startMs = new Date(span.start_time).getTime();
    const offsetPct = ((startMs - traceStartMs) / traceDurationMs) * 100;
    const widthPct = Math.max(0.5, (span.duration_ms / traceDurationMs) * 100);
    return {
      id: span.span_id,
      label: span.name,
      offset: `${offsetPct.toFixed(2)}%`,
      width: `${Math.min(widthPct, 100 - offsetPct).toFixed(2)}%`,
      color: spanColor(span, palette),
      dur: `${span.duration_ms.toFixed(2)}ms`,
      error: span.status_code === 'STATUS_CODE_ERROR',
      attributes: span.attributes,
      children: span.children.map(convert),
    };
  }

  return { spans: roots.map(convert), traceStartMs, traceDurationMs };
}

function countErrors(roots: SpanTreeNode[]): number {
  let n = 0;
  function visit(s: SpanTreeNode) {
    if (s.status_code === 'STATUS_CODE_ERROR') n++;
    s.children.forEach(visit);
  }
  roots.forEach(visit);
  return n;
}

export const CompareTracesPanel = () => {
  const [activeTab, setActiveTab] = useState('Gantt Timeline');
  const [leftDropdownOpen, setLeftDropdownOpen] = useState(false);
  const [rightDropdownOpen, setRightDropdownOpen] = useState(false);
  const [expandedSpans, setExpandedSpans] = useState<Record<string, boolean>>({});
  const [selectedSpan, setSelectedSpan] = useState<GanttSpan | null>(null);

  const [leftTraceId, setLeftTraceId] = useState<string | null>(null);
  const [rightTraceId, setRightTraceId] = useState<string | null>(null);
  const [leftTree, setLeftTree] = useState<TraceTreeResponse | null>(null);
  const [rightTree, setRightTree] = useState<TraceTreeResponse | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

  const { selectedAgent } = useAgent();

  // Agent-scoped SSE stream -- only this agent's live events, matching the
  // header selector (was `undefined` = every agent, which is what let another
  // agent's traces leak into this panel).
  const { events, connected } = useOracleStream(selectedAgent?.id, 300);

  // Preloaded recent traces for the selected agent (GET /v1/agent/{id}/otel/traces).
  const [historicalTraces, setHistoricalTraces] = useState<Array<[string, string]>>([]);
  useEffect(() => {
    if (!selectedAgent) {
      setHistoricalTraces([]);
      return;
    }
    let cancelled = false;
    oracle
      .getRecentTraces(selectedAgent.id, 25)
      .then((rows) => { if (!cancelled) setHistoricalTraces(rows.map((r) => [r.trace_id, r.name] as [string, string])); })
      .catch(() => { if (!cancelled) setHistoricalTraces([]); });
    return () => { cancelled = true; };
  }, [selectedAgent]);

  const recentTraces = useMemo(() => {
    const seen = new Map<string, string>(); // trace_id -> most recent span name seen
    // Live-stream-discovered first (most recent), scoped to the selected agent.
    for (const e of events) {
      if (e.type === 'OtelSpan' && (!selectedAgent || e.agent_id === selectedAgent.id)) {
        seen.set(e.trace_id, e.name);
      }
    }
    // Then fill in the preloaded historical traces not already seen live.
    for (const [traceId, name] of historicalTraces) {
      if (!seen.has(traceId)) seen.set(traceId, name);
    }
    return Array.from(seen.entries());
  }, [events, selectedAgent, historicalTraces]);

  // When the agent changes, clear the previous agent's selected traces so we
  // don't show one agent's trace under another agent's header.
  useEffect(() => {
    setLeftTraceId(null);
    setRightTraceId(null);
    setLeftTree(null);
    setRightTree(null);
  }, [selectedAgent]);

  useEffect(() => {
    if (!leftTraceId && recentTraces.length > 0) setLeftTraceId(recentTraces[0][0]);
    if (!rightTraceId && recentTraces.length > 1) setRightTraceId(recentTraces[1][0]);
  }, [recentTraces, leftTraceId, rightTraceId]);

  useEffect(() => {
    if (!leftTraceId) return;
    let cancelled = false;
    setLeftError(null);
    oracle.getTraceTree(leftTraceId)
      .then((t) => { if (!cancelled) setLeftTree(t); })
      .catch((err) => { if (!cancelled) setLeftError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [leftTraceId]);

  useEffect(() => {
    if (!rightTraceId) return;
    let cancelled = false;
    setRightError(null);
    oracle.getTraceTree(rightTraceId)
      .then((t) => { if (!cancelled) setRightTree(t); })
      .catch((err) => { if (!cancelled) setRightError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [rightTraceId]);

  const leftGantt = useMemo(() => leftTree ? treeToGantt(leftTree.roots, 'primary') : null, [leftTree]);
  const rightGantt = useMemo(() => rightTree ? treeToGantt(rightTree.roots, 'gold') : null, [rightTree]);

  const toggleSpan = (spanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSpans(prev => ({ ...prev, [spanId]: !prev[spanId] }));
  };

  const renderDropdown = (isOpen: boolean, onSelect: (id: string) => void, close: () => void) => {
    if (!isOpen) return null;
    return (
      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: 'var(--radius-md)', zIndex: 100, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', maxHeight: '260px', overflowY: 'auto' }}>
        {recentTraces.length === 0 && (
          <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {selectedAgent ? 'No traces recorded for this agent yet.' : 'Select an agent in the header to load its traces.'}
          </div>
        )}
        {recentTraces.map(([traceId, name]) => (
          <div
            key={traceId}
            style={{ padding: '12px', borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.3)', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onClick={() => { onSelect(traceId); close(); }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsla(var(--bg-panel-hover-hsl) / 0.4)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {traceId}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderSpanTree = (spans: GanttSpan[], depth = 0, colorLabel: string) => {
    return spans.map((span) => {
      const isExpanded = expandedSpans[span.id] ?? true;
      const hasChildren = span.children.length > 0;

      return (
        <div key={span.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="gantt-row" style={{ position: 'relative', cursor: 'pointer', marginLeft: `${depth * 12}px` }} onClick={() => setSelectedSpan(span)}>
            <div style={{ display: 'flex', marginLeft: span.offset, width: span.width, background: span.error ? 'rgba(244, 63, 94, 0.1)' : `rgba(${colorLabel === 'gold' ? '212, 175, 55' : '59, 130, 246'}, 0.1)`, border: `1px solid ${span.color}`, padding: '6px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
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
              {renderSpanTree(span.children, depth + 1, colorLabel)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderTraceColumn = (traceId: string | null, tree: TraceTreeResponse | null, gantt: ReturnType<typeof treeToGantt> | null, error: string | null, colorVar: string, colorLabel: string) => (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {!traceId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px' }}>
          {recentTraces.length > 0
            ? 'Pick a trace from the dropdown above to compare.'
            : selectedAgent
              ? 'No traces recorded for this agent yet.'
              : 'Select an agent in the header to load its traces.'}
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '24px' }}>
          Could not load trace {traceId}: {error}
        </div>
      ) : !tree || !gantt ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading trace {traceId}…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem', marginBottom: '16px', background: `rgba(${colorLabel === 'gold' ? '212, 175, 55' : '59, 130, 246'}, 0.05)`, padding: '12px', borderRadius: '6px', borderLeft: `3px solid ${colorVar}` }}>
            <div><Clock size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-muted)' }}>Duration:</span> {gantt.traceDurationMs.toFixed(2)}ms</div>
            <div><AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-muted)' }}>Errors:</span> <span style={{ color: countErrors(tree.roots) > 0 ? 'var(--danger)' : 'var(--success)' }}>{countErrors(tree.roots)}</span></div>
            <div style={{ color: 'var(--text-muted)' }}>{tree.span_count} spans{tree.truncated ? ' (truncated)' : ''}</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'Gantt Timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {renderSpanTree(gantt.spans, 0, colorLabel)}
              </div>
            )}

            {activeTab === 'JSON Payload Diff' && (
              <div style={{ padding: '16px', background: '#0f111a', borderRadius: '6px', border: '1px solid #1f2937', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Code size={14} /> Root Span Attributes</h4>
                </div>
                <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {JSON.stringify(tree.roots.map(r => ({ name: r.name, attributes: r.attributes })), null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'Flame Graph' && (() => {
              const rows: GanttSpan[][] = [];
              function collect(spans: GanttSpan[], depth = 0) {
                if (spans.length === 0) return;
                if (!rows[depth]) rows[depth] = [];
                for (const s of spans) {
                  rows[depth].push(s);
                  collect(s.children, depth + 1);
                }
              }
              collect(gantt.spans);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-main)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)', flex: 1, overflowY: 'auto' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stack Trace Depth (Top-down Execution)</span>
                    <span>Total Spans: {tree.span_count}</span>
                  </div>
                  {/* Depth axis + proportional bars. Each bar's left/width come
                      from the span's REAL start_time offset and duration
                      relative to the whole trace (treeToGantt) -- a genuine
                      icicle/flame layout, so a child that consumes most of its
                      parent's time legitimately spans most of the row, and a
                      quick sibling shows as a narrow sliver. A firm min-width
                      keeps very short spans clickable/labelled rather than
                      collapsing to an invisible hairline. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative', width: '100%' }}>
                    {rows.map((row, depth) => (
                      <div key={depth} style={{ display: 'flex', width: '100%', height: '30px', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden' }}>
                        <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: 'var(--text-muted)', zIndex: 2, pointerEvents: 'none', opacity: 0.6 }}>L{depth}</span>
                        {row.map((span) => {
                          const widthPct = Math.max(6, parseFloat(span.width));
                          return (
                          <div
                            key={span.id}
                            onClick={() => setSelectedSpan(span)}
                            title={`${span.label} — ${span.dur}`}
                            style={{
                              position: 'absolute',
                              left: span.offset,
                              width: `${widthPct}%`,
                              maxWidth: `calc(100% - ${span.offset})`,
                              height: '100%',
                              background: span.error ? 'rgba(244, 63, 94, 0.25)' : `rgba(${colorLabel === 'gold' ? '212, 175, 55' : '59, 130, 246'}, 0.25)`,
                              border: `1px solid ${span.color}`,
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.7rem',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              padding: '0 8px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.filter = 'brightness(1.3)';
                              e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.3)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.filter = 'none';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{span.label}</span>
                            <span style={{ marginLeft: 'auto', opacity: 0.65, fontSize: '0.62rem', flexShrink: 0 }}>{span.dur}</span>
                          </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );

  // Real deviation summary -- genuinely computed from the two fetched trees,
  // not curated per a fixed trace-ID pair. Modest but honest: duration delta,
  // error-count delta, root-span-name mismatch.
  const deviations = useMemo(() => {
    if (!leftTree || !rightTree || !leftGantt || !rightGantt) return null;
    const out: { title: string; detail: string; color: string }[] = [];
    const durDelta = rightGantt.traceDurationMs - leftGantt.traceDurationMs;
    if (Math.abs(durDelta) > 1) {
      out.push({
        title: 'Latency Delta',
        detail: `Trace B is ${Math.abs(durDelta).toFixed(2)}ms ${durDelta > 0 ? 'slower' : 'faster'} than Trace A (${rightGantt.traceDurationMs.toFixed(2)}ms vs ${leftGantt.traceDurationMs.toFixed(2)}ms).`,
        color: '#fbbf24',
      });
    }
    const errDelta = countErrors(rightTree.roots) - countErrors(leftTree.roots);
    if (errDelta !== 0) {
      out.push({
        title: 'Error Count Delta',
        detail: `Trace B has ${Math.abs(errDelta)} ${errDelta > 0 ? 'more' : 'fewer'} error span(s) than Trace A.`,
        color: '#f87171',
      });
    }
    const leftRootNames = new Set(leftTree.roots.map(r => r.name));
    const rightRootNames = new Set(rightTree.roots.map(r => r.name));
    const onlyLeft = [...leftRootNames].filter(n => !rightRootNames.has(n));
    const onlyRight = [...rightRootNames].filter(n => !leftRootNames.has(n));
    if (onlyLeft.length || onlyRight.length) {
      out.push({
        title: 'Root Span Mismatch',
        detail: `${onlyLeft.length ? `Only in A: ${onlyLeft.join(', ')}. ` : ''}${onlyRight.length ? `Only in B: ${onlyRight.join(', ')}.` : ''}`,
        color: 'var(--primary)',
      });
    }
    return out;
  }, [leftTree, rightTree, leftGantt, rightGantt]);

  const leftName = leftTraceId ? (recentTraces.find(([id]) => id === leftTraceId)?.[1] ?? leftTraceId) : 'Select a trace';
  const rightName = rightTraceId ? (recentTraces.find(([id]) => id === rightTraceId)?.[1] ?? rightTraceId) : 'Select a trace';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Gantt Timeline', 'JSON Payload Diff', 'Flame Graph'].map((tab) => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {tab}
            </div>
          ))}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />} {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {/* Trace Selectors */}
      <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: '16px' }}>
        <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
          <div
            onClick={() => setLeftDropdownOpen(!leftDropdownOpen)}
            style={{ padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', flex: 1, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>Trace A</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{leftName} {leftTraceId && <span style={{ color: 'var(--text-muted)' }}>[{leftTraceId}]</span>}</div>
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
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{rightName} {rightTraceId && <span style={{ color: 'var(--text-muted)' }}>[{rightTraceId}]</span>}</div>
            </div>
            <ChevronDown size={16} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
          </div>
          {renderDropdown(rightDropdownOpen, setRightTraceId, () => setRightDropdownOpen(false))}
        </div>

        <div style={{ flex: '0 0 250px' }}></div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', overflow: 'hidden' }}>
        {renderTraceColumn(leftTraceId, leftTree, leftGantt, leftError, 'var(--primary)', 'primary')}
        {renderTraceColumn(rightTraceId, rightTree, rightGantt, rightError, 'var(--gold)', 'gold')}

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
                  {/* Real SpanTreeNode data has one attributes bag, not a
                      separate inputs/outputs split -- showing it as one
                      section rather than inventing a division the real
                      OTel schema doesn't have. */}
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Attributes</h4>
                  <div style={{ background: '#0f111a', padding: '12px', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: selectedSpan.error ? '#fca5a5' : '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {Object.keys(selectedSpan.attributes).length ? JSON.stringify(selectedSpan.attributes, null, 2) : 'No attributes recorded for this span'}
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

              {deviations && deviations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  {deviations.map((d, i) => (
                    <div key={i} style={{ padding: '12px', borderLeft: `3px solid ${d.color}`, background: `${d.color}1a`, borderRadius: '0 4px 4px 0' }}>
                      <h4 style={{ fontSize: '0.75rem', color: d.color, marginBottom: '4px' }}>{d.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '12px', background: 'var(--bg-main)', borderRadius: '4px' }}>
                  {leftTree && rightTree ? 'No significant deviations detected between these traces.' : 'Select two real traces to compute deviations.'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
