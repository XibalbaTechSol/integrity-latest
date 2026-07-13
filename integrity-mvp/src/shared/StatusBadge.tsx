import React from 'react';

const STATUS_CLASS: Record<string, string> = {
  certified: 'badge-success',
  valid: 'badge-success',
  open: 'badge-success',
  active: 'badge-success',
  released: 'badge-success',
  pending: 'badge-warning',
  escrowed: 'badge-warning',
  warning: 'badge-danger',
  closed: 'badge-danger',
  refunded: 'badge-danger',
  failed: 'badge-danger',
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`badge ${STATUS_CLASS[status.toLowerCase()] || 'badge-warning'}`}>
    {status}
  </span>
);
