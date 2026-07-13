import React from 'react';
import { Network, ShieldCheck, XCircle, Cpu, Database, Key } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type TraceNodeType = 'root' | 'success' | 'danger' | 'process' | 'database' | 'crypto';

interface TraceNodeData extends Record<string, unknown> {
  type: TraceNodeType;
  title: string;
  subtitle: string;
}

const getStyles = (type: TraceNodeType, active: boolean) => {
  const base = {
    padding: '16px',
    borderRadius: 'var(--radius-lg)',
    width: '240px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    transform: active ? 'scale(1.05)' : 'scale(1)',
    zIndex: active ? 10 : 1,
  };

  if (type === 'root') {
    return {
      ...base,
      background: active ? 'rgba(59, 130, 246, 0.15)' : 'var(--primary-dim)',
      border: `1px solid var(--primary)`,
      boxShadow: active ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none'
    };
  }
  if (type === 'danger') {
    return {
      ...base,
      background: active ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.05)',
      border: `1px dashed var(--danger)`,
      boxShadow: active ? '0 0 20px rgba(244, 63, 94, 0.3)' : 'none'
    };
  }
  if (type === 'success') {
    return {
      ...base,
      background: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
      border: `1px solid var(--success)`,
      boxShadow: active ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none'
    };
  }
  if (type === 'process') {
    return {
      ...base,
      background: active ? '#1a1f2e' : 'var(--bg-main)',
      border: `1px solid var(--border-color)`,
      boxShadow: active ? '0 0 20px rgba(255, 255, 255, 0.1)' : '0 0 20px rgba(0, 0, 0, 0.1)'
    };
  }
  if (type === 'crypto') {
    return {
      ...base,
      background: active ? 'rgba(212, 175, 55, 0.15)' : 'rgba(212, 175, 55, 0.05)',
      border: `1px solid var(--gold)`,
      boxShadow: active ? '0 0 20px rgba(212, 175, 55, 0.3)' : 'none'
    };
  }
  return {
    ...base,
    background: 'var(--bg-main)',
    border: '1px solid var(--border-color)'
  };
};

const getIcon = (type: TraceNodeType) => {
  switch (type) {
    case 'root': return <Network size={16} />;
    case 'success': return <ShieldCheck size={16} />;
    case 'danger': return <XCircle size={16} />;
    case 'process': return <Cpu size={16} />;
    case 'database': return <Database size={16} />;
    case 'crypto': return <Key size={16} />;
    default: return <Network size={16} />;
  }
};

const getColor = (type: TraceNodeType) => {
  switch (type) {
    case 'root': return 'var(--primary)';
    case 'success': return 'var(--success)';
    case 'danger': return 'var(--danger)';
    case 'process': return 'white';
    case 'crypto': return 'var(--gold)';
    default: return 'white';
  }
};

export const TraceNode = ({ data, selected }: NodeProps<any>) => {
  const { type, title, subtitle } = data as TraceNodeData;
  const active = !!selected;

  return (
    <>
      {type !== 'root' && <Handle type="target" position={Position.Left} style={{ background: '#555', border: 'none' }} />}
      <div style={getStyles(type, active)}>
        <h3 style={{ fontSize: '0.85rem', color: getColor(type), marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getIcon(type)} {title}
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555', border: 'none' }} />
    </>
  );
};
