import { NotionDatabase } from 'integrity-mvp';

interface AgentRow {
  did: string;
  ais: number;
  tier: string;
  status: string;
}

const rows: AgentRow[] = [
  { did: 'did:intg:0x7a2...f89c', ais: 942, tier: 'A', status: 'Active' },
  { did: 'did:intg:0x3b1...c221', ais: 871, tier: 'B', status: 'Active' },
  { did: 'did:intg:0x9f4...11ae', ais: 640, tier: 'C', status: 'Disputed' },
];

const columns = [
  { accessorKey: 'did', header: 'Agent DID' },
  { accessorKey: 'ais', header: 'AIS' },
  { accessorKey: 'tier', header: 'Tier' },
  { accessorKey: 'status', header: 'Status' },
];

export const Default = () => (
  <NotionDatabase<AgentRow> data={rows} columns={columns} title="Registered Agents" />
);

export const ReadOnly = () => (
  <NotionDatabase<AgentRow> data={rows} columns={columns} title="Registered Agents" readOnly />
);
