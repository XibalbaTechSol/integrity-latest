import { FileText, Database, Network, RefreshCw, Layers, UploadCloud } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { NotionDatabase } from '../components/NotionDatabase';
import { createColumnHelper } from '@tanstack/react-table';

const SYNC_DATA = [
  { day: 'Mon', chunks: 1200 },
  { day: 'Tue', chunks: 2100 },
  { day: 'Wed', chunks: 1800 },
  { day: 'Thu', chunks: 3400 },
  { day: 'Fri', chunks: 2800 },
  { day: 'Sat', chunks: 4100 },
  { day: 'Sun', chunks: 4800 }
];

const DOCUMENTS = [
  { name: 'HIPAA_Compliance_Guidelines_2026.pdf', cid: 'QmYwAPJzv5CZsnA625s3Xf2b...', status: 'Indexed', chunks: 420, date: '2 hours ago' },
  { name: 'Patient_Onboarding_Protocol.docx', cid: 'QmZp1HhXw2Rvs9F82jN...', status: 'Indexed', chunks: 156, date: '5 hours ago' },
  { name: 'Clinical_Trial_Results_Q3.pdf', cid: 'QmT7Kk3wLp8Rt4G2N...', status: 'Indexing', chunks: '-', date: 'Just now' },
  { name: 'SmartBAA_Terms_of_Service.txt', cid: 'QmXv5VbMw9Lp8Rt4G...', status: 'Indexed', chunks: 42, date: '1 day ago' },
];

export const DocumentsPage = () => {
  const columnHelper = createColumnHelper<any>();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Filename',
      cell: info => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
            <FileText size={16} color="var(--primary)" />
          </div>
          {info.getValue()}
        </div>
      ),
      size: 350,
    }),
    columnHelper.accessor('cid', {
      header: 'IPFS CID',
      cell: info => <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{info.getValue()}</span>,
      size: 250,
    }),
    columnHelper.accessor('chunks', {
      header: 'Vector Chunks',
      cell: info => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} className="text-muted" /> {info.getValue()}
        </span>
      ),
      size: 150,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`badge ${info.getValue() === 'Indexed' ? 'badge-success' : 'badge-warning'}`}>
          {info.getValue()}
        </span>
      ),
      size: 150,
    }),
    columnHelper.accessor('date', {
      header: 'Time',
      cell: info => <span style={{ color: 'var(--text-muted)' }}>{info.getValue()}</span>,
      size: 150,
    }),
  ], [columnHelper]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      <TopBar title="Encrypted Document Vault">
        <button className="btn btn-secondary glass-panel-hover" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={16} /> Upload Document
        </button>
      </TopBar>

      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="grid grid-3 mb-6" style={{ flexShrink: 0 }}>
          <div className="card glass-panel">
            <div className="card-header">
              <h3 className="card-title">Vector DB Size</h3>
              <Database size={20} className="text-muted" />
            </div>
            <div className="stat-value">142,850 <span className="stat-label">Chunks</span></div>
            <div className="text-sm text-success mt-2">Synchronized with Arweave Permanent Storage</div>
          </div>
          <div className="card glass-panel">
            <div className="card-header">
              <h3 className="card-title">Knowledge Graph Nodes</h3>
              <Network size={20} className="text-muted" />
            </div>
            <div className="stat-value">84,210</div>
            <div className="text-sm text-muted mt-2">Zero-Knowledge Proof Attested</div>
          </div>
          <div className="card glass-panel">
            <div className="card-header">
              <h3 className="card-title">Sync Status</h3>
              <RefreshCw size={20} color="var(--primary)" />
            </div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>Healthy</div>
            <div className="text-sm text-muted mt-2">Last sync: 2 mins ago</div>
          </div>
        </div>

        <div className="card glass-panel mb-6" style={{ flexShrink: 0 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Vector Ingestion Throughput</h3>
              <p className="card-subtitle">Document chunks embedded and cryptographically signed over 7 days</p>
            </div>
          </div>
          <div style={{ height: '180px', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SYNC_DATA}>
                <defs>
                  <linearGradient id="colorSync" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="step" dataKey="chunks" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorSync)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <NotionDatabase 
            title="Recent Ingestions"
            data={DOCUMENTS}
            columns={columns}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
};
