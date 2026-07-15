import { Panel } from 'integrity-mvp';
import { ShieldCheck } from 'lucide-react';

export const Basic = () => (
  <Panel title="Network Overview">
    <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>Panel content goes here.</div>
  </Panel>
);

export const WithIconAndAction = () => (
  <Panel
    title="Compliance Status"
    icon={<ShieldCheck size={16} color="var(--success)" />}
    action={<button className="btn btn-sm">Refresh</button>}
  >
    <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>
      All active agents are within policy bounds.
    </div>
  </Panel>
);
