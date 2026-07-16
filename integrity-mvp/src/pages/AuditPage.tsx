import { useMemo } from 'react';
import { ShieldAlert, CheckCircle, XCircle, CodeSquare, AlertCircle, Clock } from 'lucide-react';
import { useLogger } from '../contexts/LoggerContext';
import { TopBar } from '../components/TopBar';
import { NotionDatabase } from '../components/NotionDatabase';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { createColumnHelper } from '@tanstack/react-table';

export const AuditPage = () => {
  const { logs } = useLogger();

  const columnHelper = createColumnHelper<any>();

  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: 'Event ID',
      cell: info => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{info.getValue()}</span>,
      size: 150,
    }),
    columnHelper.accessor('time', {
      header: 'Timestamp',
      cell: info => <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}><Clock size={12} /> {info.getValue()}</span>,
      size: 120,
    }),
    columnHelper.accessor('event', {
      header: 'Event',
      cell: info => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{info.getValue()}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{info.row.original.detail}</div>
        </div>
      ),
      size: 300,
    }),
    columnHelper.accessor('source', {
      header: 'Source',
      cell: info => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <CodeSquare size={14} color="var(--accent-primary)" />
          {info.getValue()}
        </span>
      ),
      size: 150,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const status = info.getValue();
        return (
          <span className={`badge ${status === 'Success' ? 'badge-success' : status === 'Failed' ? 'badge-danger' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
            {status === 'Success' ? <CheckCircle size={14} /> : status === 'Failed' ? <XCircle size={14} /> : <AlertCircle size={14} />}
            {status}
          </span>
        );
      },
      size: 120,
    }),
  ], [columnHelper]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Cryptographic Audit Logs" />

      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', overflow: 'hidden' }}>
        <div className="card glass-panel" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', borderLeft: '4px solid var(--success)' }}>
          <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%', color: 'var(--success)' }}>
            <ShieldAlert size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Immutable ZK Logging</h3>
              <SeededDataBadge label="Simulated event feed" />
            </div>
            <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              The BCC Middleware DOES batch approved intents into a Merkle tree and anchor each agent's
              root on-chain (best-effort, not yet on every single event) -- but the {logs.length} entries below are a
              simulated local event feed for this demo session, not a query against that real audit trail.
              <br/>No backend endpoint to list past intercept decisions exists yet; see PRODUCTION_GAPS.md.
            </p>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <NotionDatabase
            data={logs}
            columns={columns}
            title="Simulated Event Stream"
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
};
