import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { ShieldCheck, ShieldAlert, FileText, Lock, Activity, AlertTriangle, Award, Database, Network, RefreshCw, Layers, UploadCloud } from 'lucide-react';
import { NotionDatabase } from '../components/NotionDatabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ColumnDef } from '@tanstack/react-table';
import { useAccount } from 'wagmi';
import { getPublicClient, readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseAbiItem, formatUnits, encodeFunctionData } from 'viem';
import { useAgent } from '../contexts/AgentContext';
import { useToast } from '../contexts/ToastContext';
import { oracle, type AisResponse } from '../services/oracle';
import { wagmiConfig } from '../chain/wagmi';
import { abis } from '../chain/abis';
import { singleton } from '../chain/deployments';

const BAA_STATUS_LABELS = ['Proposed', 'Active', 'Disputed', 'Terminated'] as const;

interface RealBaa {
  address: `0x${string}`;
  coveredEntity: `0x${string}`;
  businessAssociate: `0x${string}`;
  agreementHash: `0x${string}`;
  requiredCollateral: bigint;
  status: number;
}

const BAA_COLUMNS = (isBusinessAssociate: (a: string) => boolean, onSign: (b: RealBaa) => void, onRevoke: (b: RealBaa) => void, busy: string | null): ColumnDef<RealBaa>[] => [
  { accessorKey: 'coveredEntity', header: 'Covered Entity', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{info.getValue() as string}</span> },
  { accessorKey: 'status', header: 'Status', cell: info => {
      const s = info.getValue() as number;
      return <span className={`badge ${s === 1 ? 'badge-success' : s === 3 ? 'badge-danger' : 'badge-warning'}`}>{BAA_STATUS_LABELS[s] ?? s}</span>;
    } },
  { accessorKey: 'requiredCollateral', header: 'Required Collateral', cell: info => <span style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{formatUnits(info.getValue() as bigint, 18)} ITK</span> },
  { accessorKey: 'agreementHash', header: 'Agreement Hash', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{(info.getValue() as string).slice(0, 10)}...</span> },
  { id: 'actions', header: 'Action', cell: ({ row }) => {
      const b = row.original;
      if (!isBusinessAssociate(b.businessAssociate)) return <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Not your agent</span>;
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          {b.status === 0 && (
            <button className="btn" style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--success)', border: '1px solid var(--success)', padding: '4px 8px', fontSize: '0.7rem' }} disabled={busy === b.address} onClick={() => onSign(b)}>
              {busy === b.address ? 'Signing...' : 'SIGN'}
            </button>
          )}
          {b.status === 1 && (
            <button className="btn" style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '4px 8px', fontSize: '0.7rem' }} disabled={busy === b.address} onClick={() => onRevoke(b)}>
              {busy === b.address ? 'Revoking...' : 'REVOKE'}
            </button>
          )}
        </div>
      );
    } },
];

const MOCK_AUDIT_LOGS = [
  { id: '1', time: '2026-06-25 01:50:23', action: 'DECRYPT_EHR', agent: 'Xibalba Master Agent', result: 'PASSED' },
  { id: '2', time: '2026-06-25 02:02:11', action: 'QUERY_PATIENT_PHI', agent: 'Xibalba Master Agent', result: 'BLOCKED' },
];

const AUDIT_COLUMNS: ColumnDef<any>[] = [
  { accessorKey: 'time', header: 'Time', cell: info => <span style={{ color: 'var(--text-muted)' }}>{info.getValue() as string}</span> },
  { accessorKey: 'action', header: 'Action', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue() as string}</span> },
  { accessorKey: 'agent', header: 'Agent' },
  { accessorKey: 'result', header: 'Result', cell: info => <span className={`badge ${info.getValue() === 'PASSED' ? 'badge-success' : 'badge-danger'}`}>{info.getValue() as string}</span> },
];

const MOCK_QUARANTINE = [
  { id: '1', did: 'did:intg:agent-007', reason: 'PHI Exfiltration Attempt', status: 'LOCKED' }
];

const QUARANTINE_COLUMNS: ColumnDef<any>[] = [
  { accessorKey: 'did', header: 'Agent DID', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{info.getValue() as string}</span> },
  { accessorKey: 'reason', header: 'Violation Reason', cell: info => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{info.getValue() as string}</span> },
  { accessorKey: 'status', header: 'Status', cell: info => <span className="badge badge-danger">{info.getValue() as string}</span> },
];

// Merged in from the former standalone DocumentsPage (PRODUCTION_GAPS.md
// §7) -- HIPAA/clinical document content belongs on the compliance page
// its own filenames are about, not a separate top-level nav item. Still
// fully disclosed: no document ingestion/RAG-indexing backend exists
// anywhere in this monorepo, every number/row below remains fabricated.
const DOCUMENT_SYNC_DATA = [
  { day: 'Mon', chunks: 1200 },
  { day: 'Tue', chunks: 2100 },
  { day: 'Wed', chunks: 1800 },
  { day: 'Thu', chunks: 3400 },
  { day: 'Fri', chunks: 2800 },
  { day: 'Sat', chunks: 4100 },
  { day: 'Sun', chunks: 4800 }
];

const MOCK_DOCUMENTS = [
  { name: 'HIPAA_Compliance_Guidelines_2026.pdf', cid: 'QmYwAPJzv5CZsnA625s3Xf2b...', status: 'Indexed', chunks: 420, date: '2 hours ago' },
  { name: 'Patient_Onboarding_Protocol.docx', cid: 'QmZp1HhXw2Rvs9F82jN...', status: 'Indexed', chunks: 156, date: '5 hours ago' },
  { name: 'Clinical_Trial_Results_Q3.pdf', cid: 'QmT7Kk3wLp8Rt4G2N...', status: 'Indexing', chunks: '-', date: 'Just now' },
  { name: 'SmartBAA_Terms_of_Service.txt', cid: 'QmXv5VbMw9Lp8Rt4G...', status: 'Indexed', chunks: 42, date: '1 day ago' },
];

const DOCUMENT_COLUMNS: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: 'Filename',
    cell: info => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500 }}>
        <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.5)', padding: '8px', borderRadius: '8px' }}>
          <FileText size={16} color="var(--primary)" />
        </div>
        {info.getValue() as string}
      </div>
    ),
    size: 350,
  },
  {
    accessorKey: 'cid',
    header: 'IPFS CID',
    cell: info => <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{info.getValue() as string}</span>,
    size: 250,
  },
  {
    accessorKey: 'chunks',
    header: 'Vector Chunks',
    cell: info => (
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Layers size={14} className="text-muted" /> {info.getValue() as string | number}
      </span>
    ),
    size: 150,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: info => (
      <span className={`badge ${info.getValue() === 'Indexed' ? 'badge-success' : 'badge-warning'}`}>
        {info.getValue() as string}
      </span>
    ),
    size: 150,
  },
  {
    accessorKey: 'date',
    header: 'Time',
    cell: info => <span style={{ color: 'var(--text-muted)' }}>{info.getValue() as string}</span>,
    size: 150,
  },
];

type ShieldSubTab = 'Stability Certification' | 'Smart BAAs' | 'PHI Access Gates' | 'Audit & Compliance' | 'Quarantine Zone' | 'Documents';
const SUB_TABS: { id: ShieldSubTab; icon: React.ReactNode }[] = [
  { id: 'Stability Certification', icon: <Award size={14} /> },
  { id: 'Smart BAAs', icon: <FileText size={14} /> },
  { id: 'PHI Access Gates', icon: <Lock size={14} /> },
  { id: 'Audit & Compliance', icon: <Activity size={14} /> },
  { id: 'Quarantine Zone', icon: <AlertTriangle size={14} /> },
  { id: 'Documents', icon: <Database size={14} /> },
];

export const ShieldPage = () => {
  const [activeTab, setActiveTab] = useState<ShieldSubTab>('Stability Certification');
  const { address } = useAccount();
  const { selectedAgent } = useAgent();
  const { addToast } = useToast();

  const [baas, setBaas] = useState<RealBaa[]>([]);
  const [baasError, setBaasError] = useState<string | null>(null);
  const [baasLoading, setBaasLoading] = useState(true);
  const [busyBaa, setBusyBaa] = useState<string | null>(null);

  const loadBaas = useCallback(async () => {
    if (!selectedAgent) { setBaasLoading(false); return; }
    setBaasLoading(true);
    setBaasError(null);
    try {
      const agent = await oracle.getAgent(selectedAgent.id);
      const sovereignAgent = agent.primitives?.sovereign_agent as `0x${string}` | undefined;
      if (!sovereignAgent) { setBaas([]); return; }

      const client = getPublicClient(wagmiConfig);
      if (!client) throw new Error('No chain client available');
      const logs = await client.getLogs({
        address: singleton('SmartBAAFactory'),
        event: parseAbiItem('event BAACreated(address indexed coveredEntity, address indexed businessAssociate, address baa, bytes32 agreementHash)'),
        args: { businessAssociate: sovereignAgent },
        fromBlock: 0n,
        toBlock: 'latest',
      });

      const found = await Promise.all(
        logs.map(async (log) => {
          const baaAddress = log.args.baa as `0x${string}`;
          const [status, requiredCollateral] = await Promise.all([
            readContract(wagmiConfig, { address: baaAddress, abi: abis.SmartBAA, functionName: 'status' }),
            readContract(wagmiConfig, { address: baaAddress, abi: abis.SmartBAA, functionName: 'requiredCollateral' }),
          ]);
          return {
            address: baaAddress,
            coveredEntity: log.args.coveredEntity as `0x${string}`,
            businessAssociate: log.args.businessAssociate as `0x${string}`,
            agreementHash: log.args.agreementHash as `0x${string}`,
            requiredCollateral: requiredCollateral as bigint,
            status: status as number,
          };
        }),
      );
      setBaas(found);
    } catch (e) {
      setBaasError(e instanceof Error ? e.message : 'Failed to read BAAs from chain');
    } finally {
      setBaasLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { loadBaas(); }, [loadBaas]);

  // PRODUCTION_GAPS.md §7: "Stability Certification" tab used to be 100%
  // hardcoded (AAA / 99.9% / 82.4% / 1.8x) despite this same page already
  // proving the real oracle+on-chain-read pattern (loadBaas above). Wired
  // to real data where it actually exists: AIS score for the tier, and the
  // real `baas` array (fetched above) for the compliance ratio. "Prediction
  // Accuracy (Markets)" and "Collateral Health Factor" have NO real backend
  // source anywhere in this monorepo (no market-prediction-scoring endpoint,
  // no Slasher stake data wired to the frontend) -- rendered as an honest
  // "not available" state below instead of a fabricated number.
  const [ais, setAis] = useState<AisResponse | null>(null);
  const [aisError, setAisError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgent) { setAis(null); return; }
    let cancelled = false;
    setAisError(null);
    oracle.getAis(selectedAgent.id)
      .then((res) => { if (!cancelled) setAis(res); })
      .catch((e) => { if (!cancelled) setAisError(e instanceof Error ? e.message : 'Failed to fetch AIS'); });
    return () => { cancelled = true; };
  }, [selectedAgent]);

  function stabilityTier(score: number): { label: string; color: string } {
    if (score >= 900) return { label: 'AAA', color: 'var(--success)' };
    if (score >= 700) return { label: 'A', color: 'var(--success)' };
    if (score >= 500) return { label: 'B', color: 'var(--warning)' };
    return { label: 'C', color: 'var(--danger)' };
  }

  const activeBaaCount = baas.filter((b) => b.status === 1).length;
  const baaComplianceRatio = baas.length > 0 ? (activeBaaCount / baas.length) * 100 : null;

  const isBusinessAssociate = useCallback((sovereignAgent: string) => {
    // A signable/revocable BAA still requires the connected EOA to be the
    // agent's controller (execute() is onlyController) — this is a display
    // hint, the real check happens on-chain when the tx is sent.
    return !!address && !!sovereignAgent;
  }, [address]);

  const handleSignBaa = async (baa: RealBaa) => {
    if (!selectedAgent) return;
    setBusyBaa(baa.address);
    try {
      const agent = await oracle.getAgent(selectedAgent.id);
      const sovereignAgent = agent.primitives?.sovereign_agent as `0x${string}` | undefined;
      if (!sovereignAgent) throw new Error('Agent has no registered primitives');
      const calldata = encodeFunctionData({ abi: abis.SmartBAA, functionName: 'sign' });
      const hash = await writeContract(wagmiConfig, {
        address: sovereignAgent,
        abi: abis.SovereignAgent,
        functionName: 'execute',
        args: [baa.address, 0n, calldata],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      addToast('success', 'BAA signed.');
      loadBaas();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Sign failed.');
    } finally {
      setBusyBaa(null);
    }
  };

  const handleRevokeBaa = async (baa: RealBaa) => {
    if (!selectedAgent) return;
    setBusyBaa(baa.address);
    try {
      const agent = await oracle.getAgent(selectedAgent.id);
      const sovereignAgent = agent.primitives?.sovereign_agent as `0x${string}` | undefined;
      if (!sovereignAgent) throw new Error('Agent has no registered primitives');
      const calldata = encodeFunctionData({ abi: abis.SmartBAA, functionName: 'revoke' });
      const hash = await writeContract(wagmiConfig, {
        address: sovereignAgent,
        abi: abis.SovereignAgent,
        functionName: 'execute',
        args: [baa.address, 0n, calldata],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      addToast('success', 'BAA revoked.');
      loadBaas();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Revoke failed.');
    } finally {
      setBusyBaa(null);
    }
  };

  const [consents, setConsents] = useState([
    { id: 'con_gate_101', patientDid: 'did:xibalba:patient:0x71c7...281b', requestingEntity: '0xMayo_Clinic_Minnesota_39a', recordHash: '0x8f1a32...f2910', status: 'Authorized', lastUpdated: '2026-06-24 16:45' },
    { id: 'con_gate_102', patientDid: 'did:xibalba:patient:0xaa12...009f', requestingEntity: '0xHealth_Provider_Clinic_88a', recordHash: '0xc5d246...e500b', status: 'Pending', lastUpdated: '2026-06-25 01:10' }
  ]);

  const [violations, setViolations] = useState([
    { id: 'viol_01', time: '2026-06-25 02:02:11', agent: 'Xibalba Master Agent', baaId: 'baa_contract_02', type: 'unauthorized_phi_query', detail: 'Attempted to query out-of-bounds EHR record without active BAA consent approval signature.', status: 'pending' }
  ]);

  // Both handlers below operate on the hardcoded `consents`/`violations` seed
  // arrays above (SeededDataBadge-marked), not real data, and make NO
  // contract call -- EHRGate.grantAccess/revokeAccess are PATIENT-signed
  // (not this dashboard operator's wallet), and a real slash requires the
  // Slasher contract's arbiter role after a full dispute/challenge window
  // (see contracts/src/oracle/Slasher.sol's NatSpec) -- neither maps to a
  // button an arbitrary connected wallet on this page could honestly
  // trigger for real. Previously these showed a real-looking, undisclosed
  // "successfully updated"/"confirmed... Slashed" alert implying a genuine
  // on-chain state change had occurred; PRODUCTION_GAPS.md §7 flagged this
  // as a false claim. Now explicitly disclosed via the same addToast(...)
  // path the REAL wagmi-backed BAA sign/revoke handlers above use, instead
  // of a jarring, differently-styled browser alert() that read as more
  // "real" than the toasted success messages next to it.
  const handleToggleConsent = (id: string, action: 'Authorized' | 'Revoked') => {
    setTimeout(() => {
      setConsents(prev => prev.map(c => c.id === id ? { ...c, status: action, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) } : c));
      addToast('info', `Simulated only: EHR Gate would be ${action.toLowerCase()} via the patient's own signature. No transaction was sent.`);
    }, 500);
  };

  const handleSlashViolation = (id: string) => {
    setViolations(prev => prev.map(v => v.id === id ? { ...v, status: 'slashed' } : v));
    addToast('info', 'Simulated only: a real slash requires the Slasher contract\'s arbiter role after a dispute window. No transaction was sent.');
  };

  const CONSENT_COLUMNS: ColumnDef<any>[] = [
    { accessorKey: 'patientDid', header: 'Patient DID', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{(info.getValue() as string).substring(0, 15)}...</span> },
    { accessorKey: 'requestingEntity', header: 'Requester', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{(info.getValue() as string).substring(0, 12)}...</span> },
    { accessorKey: 'recordHash', header: 'Record Hash', cell: info => <span style={{ fontFamily: 'var(--font-mono)' }}>{(info.getValue() as string).substring(0, 10)}...</span> },
    { accessorKey: 'status', header: 'Status', cell: info => {
        const status = info.getValue() as string;
        return <span className={`badge ${status === 'Authorized' ? 'badge-success' : status === 'Revoked' ? 'badge-danger' : 'badge-warning'}`}>{status}</span>;
      }
    },
    { id: 'actions', header: 'Action', cell: ({ row }) => {
        const c = row.original;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {c.status !== 'Authorized' && (
              <button className="btn" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid var(--success)', padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => handleToggleConsent(c.id, 'Authorized')}>AUTHORIZE</button>
            )}
            {c.status !== 'Revoked' && (
              <button className="btn" style={{ background: 'rgba(244, 63, 94, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => handleToggleConsent(c.id, 'Revoked')}>REVOKE</button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <div className="main-content">
      <TopBar title="Xibalba Shield Command Center" />
      
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ── Hero Bar ────────────────────────────────────────────── */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.05) 0%, rgba(5, 13, 24, 0.95) 100%)', border: '1px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <ShieldCheck size={24} color="var(--warning)" />
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Xibalba Shield
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Decentralized HIPAA Compliance, Automated Smart BAAs & Patient-Controlled PHI Access Gating
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', lineHeight: 1 }}>{baas.filter(b => b.status === 1).length}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '8px' }}>Active BAAs (this agent)</div>
              </div>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 20px', textAlign: 'center' }} title="No TEE enclave attestation is built — see IdentityPage">
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>—</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '8px' }}>Enclave Integrity</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sub-Nav Toggles ── */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px',
                  border: isActive ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                  background: isActive ? 'rgba(212, 175, 55, 0.1)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--warning)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                {tab.icon}
                {tab.id}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div>
          {activeTab === 'Stability Certification' && (
            <div className="grid grid-2" style={{ gap: '24px' }}>
              <div className="card col-span-2">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                  <Award size={18} color="var(--warning)"/> Agent Stability Profile
                  {!selectedAgent && <SeededDataBadge label="Select an agent for real data" />}
                </h2>

                {!selectedAgent ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px', textAlign: 'center' }}>Select an agent to see its real stability profile.</div>
                ) : aisError ? (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', padding: '24px', textAlign: 'center' }}>Could not fetch AIS: {aisError}</div>
                ) : (
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>

                  {/* Tier Badge -- derived from the real AIS score */}
                  <div style={{ flex: '1 1 30%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Stability Tier</div>
                    {ais ? (
                      <>
                        {(() => { const tier = stabilityTier(ais.ais); return (
                          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: `radial-gradient(circle, ${tier.color}33 0%, transparent 70%)`, border: `2px solid ${tier.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${tier.color}1a` }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: tier.color, textShadow: `0 0 10px ${tier.color}80` }}>{tier.label}</span>
                          </div>
                        ); })()}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Real AIS: {ais.ais.toFixed(1)} / 1000</div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
                    )}
                  </div>

                  {/* Health Factors */}
                  <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-primary)' }}>BAA Compliance Ratio</span>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {baaComplianceRatio !== null ? `${baaComplianceRatio.toFixed(1)}% (${activeBaaCount}/${baas.length} active)` : 'No BAAs yet'}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${baaComplianceRatio ?? 0}%`, height: '100%', background: 'var(--success)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Prediction Accuracy (Markets)</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontStyle: 'italic' }}>Not available</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No market-prediction-scoring endpoint exists anywhere in this monorepo yet.</div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Collateral Health Factor</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontStyle: 'italic' }}>Not available</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Slasher.sol's real stakeOf/lockedStakeOf aren't wired to this frontend yet.</div>
                    </div>

                    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        <strong>Note:</strong> Agents maintaining AAA tier receive a 50% reduction in required ITK collateral for new Smart BAAs and Escrow pools. A single slashing event will downgrade the agent to B Tier.
                      </p>
                    </div>

                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Smart BAAs' && (
            <div className="grid grid-2" style={{ gap: '24px' }}>
              <div className="card col-span-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} color="var(--warning)"/> Smart BAA Registry</h2>
                  <button className="btn" style={{ background: 'var(--accent-primary)', color: 'var(--text-primary)', padding: '6px 12px', fontSize: '0.8rem', opacity: 0.5, cursor: 'not-allowed' }} disabled title="Creating a BAA requires acting as the covered entity, a persona this dashboard doesn't represent yet">
                    + Propose BAA Contract
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Business Associate Agreements (BAAs) deployed as auto-enforcing smart contracts, read live from <code>SmartBAAFactory</code>'s <code>BAACreated</code> event log for the selected agent. Locked ITK collateral is real, read from each <code>SmartBAA</code> instance.
                </p>
                {baasError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '12px' }}>Could not read BAAs from chain ({baasError}).</div>}
                {!baasError && baasLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>Loading...</div>}
                {!baasError && !baasLoading && baas.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>No BAAs found for this agent as business associate.</div>
                )}
                <div style={{ height: '400px' }}>
                  <NotionDatabase data={baas} columns={BAA_COLUMNS(isBusinessAssociate, handleSignBaa, handleRevokeBaa, busyBaa)} title="Active BAAs" readOnly />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PHI Access Gates' && (
            <div className="grid grid-2" style={{ gap: '24px' }}>
              <div className="card col-span-2">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}><Lock size={18} color="var(--warning)"/> Patient Consent Contracts (EHR Gates) <SeededDataBadge /></h2>
                <div style={{ height: '400px' }}>
                  <NotionDatabase data={consents} columns={CONSENT_COLUMNS} title="EHR Gates" readOnly />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Audit & Compliance' && (
            <div className="grid grid-3" style={{ gap: '24px' }}>
              <div className="card col-span-2">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}><Activity size={18} color="var(--warning)"/> Medical Record Interaction Logs <SeededDataBadge /></h2>
                <div style={{ height: '400px' }}>
                  <NotionDatabase data={MOCK_AUDIT_LOGS} columns={AUDIT_COLUMNS} title="Interaction Logs" readOnly />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}><AlertTriangle size={18} color="var(--danger)"/> Compliance Review Queue <SeededDataBadge /></h2>
                {violations.map(v => (
                  <div key={v.id} style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase' }}>{v.type}</span>
                      <ShieldAlert size={16} color="var(--danger)" />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.4, wordBreak: 'break-word' }}>{v.detail}</p>
                    {v.status === 'pending' ? (
                      <button className="btn" style={{ width: '100%', background: 'var(--danger)', color: 'var(--text-primary)', border: 'none', padding: '8px', fontSize: '0.8rem' }} onClick={() => handleSlashViolation(v.id)}>Slash Stake</button>
                    ) : (
                      <span className="badge badge-danger">Slashed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Quarantine Zone' && (
            <div className="card">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}><AlertTriangle size={18} color="var(--danger)"/> Agent Circuit Breakers <SeededDataBadge /></h2>
              <div style={{ height: '300px' }}>
                <NotionDatabase data={MOCK_QUARANTINE} columns={QUARANTINE_COLUMNS} title="Circuit Breakers" readOnly />
              </div>
            </div>
          )}

          {activeTab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <AlertTriangle size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Not yet implemented</h3>
                      <SeededDataBadge label="No backend exists" />
                    </div>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      There is no document ingestion / vector-DB / RAG-indexing service anywhere in this
                      monorepo yet -- every number and row below is fabricated for this demo, not a
                      capability that exists today. See PRODUCTION_GAPS.md §7.
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-secondary glass-panel-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, cursor: 'not-allowed', flexShrink: 0 }}
                  disabled
                  title="No document/RAG-indexing backend exists yet (see PRODUCTION_GAPS.md §7) -- there is nowhere for an uploaded file to go."
                >
                  <UploadCloud size={16} /> Upload Document
                </button>
              </div>

              <div className="grid grid-3">
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

              <div className="card glass-panel">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Vector Ingestion Throughput</h3>
                    <p className="card-subtitle">Document chunks embedded and cryptographically signed over 7 days</p>
                  </div>
                </div>
                <div style={{ height: '180px', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={DOCUMENT_SYNC_DATA}>
                      <defs>
                        <linearGradient id="colorDocSync" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="step" dataKey="chunks" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorDocSync)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ height: '400px' }}>
                <NotionDatabase
                  title="Recent Ingestions"
                  data={MOCK_DOCUMENTS}
                  columns={DOCUMENT_COLUMNS}
                  readOnly={true}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
