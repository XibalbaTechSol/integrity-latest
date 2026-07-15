import { StatusBadge } from 'integrity-mvp';

export const Statuses = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
    <StatusBadge status="certified" />
    <StatusBadge status="valid" />
    <StatusBadge status="open" />
    <StatusBadge status="active" />
    <StatusBadge status="released" />
    <StatusBadge status="pending" />
    <StatusBadge status="escrowed" />
    <StatusBadge status="warning" />
    <StatusBadge status="closed" />
    <StatusBadge status="refunded" />
    <StatusBadge status="failed" />
  </div>
);
