import React, { useState } from 'react';
import { Search, Fingerprint, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { oracle, OracleError } from '../services/oracle';

// Despite the "XNS" name, this does a real DID/address lookup against the
// oracle -- there is no on-chain XibalbaNameService handle resolution
// wired up anywhere in this monorepo (previously this component silently
// faked one: any query returned the same hardcoded "Xibalba Node" result).
// Not renamed in this pass since IdentityPage.tsx imports it by this name.

// Matches RegistryExplorer.tsx's real verification_tier labels exactly --
// see that file's `tierLabels` for the source of truth.
const TIER_LABELS: Record<number, { label: string; trust: string }> = {
    0: { label: 'Unverified', trust: 'None' },
    1: { label: 'Sovereign', trust: 'Standard' },
    2: { label: 'Linked', trust: 'High' },
    3: { label: 'Institutional', trust: 'Maximum' },
};

interface XNSResult {
    alias: string;
    eth_address: string | null;
    current_ais: number | null;
    verification_tier: string;
    trust_level: string;
}

export const XNSSearchService: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<XNSResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Real GET /v1/agent/{id} + /ais lookup -- same real endpoints
    // RegistryExplorer.tsx's registry search uses. There is no separate
    // on-chain XNS handle->DID resolution route anywhere in this monorepo
    // (XNS handles like "xibalba.intg" would need a real
    // XibalbaNameService contract read), so a bare handle query (no
    // "did:integrity:" prefix, no "0x" address) is passed straight through
    // and will simply 404 against the oracle rather than being silently
    // guessed at.
    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const id = query.trim();
            const agent = await oracle.getAgent(id);
            let ais: number | null = null;
            let tier = agent.verification_tier;
            try {
                const aisRes = await oracle.getAis(id);
                ais = aisRes.ais;
            } catch {
                // AIS lookup failing (e.g. agent has no telemetry yet) shouldn't
                // hide the real agent-identity result we already have.
            }
            const tierInfo = TIER_LABELS[tier] ?? { label: String(tier), trust: 'Unknown' };
            setResult({
                alias: agent.id,
                eth_address: agent.primitives?.sovereign_agent ?? null,
                current_ais: ais,
                verification_tier: tierInfo.label,
                trust_level: tierInfo.trust,
            });
        } catch (err) {
            if (err instanceof OracleError && err.status === 404) {
                setError('Agent not found in the Integrity Registry. There is no separate XNS handle registry yet -- search by DID or registered address.');
            } else {
                setError('Unable to reach the Xibalba Identity Oracle. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-col gap-4">
            <div style={{
                display: 'flex',
                gap: '8px',
                background: 'hsla(var(--bg-panel-hsl) / 0.3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '4px 4px 4px 12px',
                alignItems: 'center'
            }}>
                <Search size={16} className="text-muted" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by DID or registered address..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        padding: '8px 0'
                    }}
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading || !query.trim()}
                    className="btn btn-sm btn-primary"
                    style={{ borderRadius: 'calc(var(--r-md) - 2px)' }}
                >
                    {isLoading ? <Loader2 size={14} className="pulse" /> : <ArrowRight size={14} />}
                </button>
            </div>

            {error && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: 'var(--r-md)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)'
                }}>
                    <AlertTriangle size={16} style={{ color: '#f43f5e', flexShrink: 0 }} />
                    {error}
                </div>
            )}

            {result && (
                <div style={{
                    padding: '16px',
                    background: 'var(--glass-surface-light)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Fingerprint size={18} style={{ color: '#10b981' }} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>
                                    {result.alias || "Agent Identified"}
                                </h4>
                                <p className="mono" style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {result.eth_address ? `${result.eth_address.slice(0, 8)}...${result.eth_address.slice(-8)}` : 'No on-chain address resolved'}
                                </p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)' }}>
                                {result.current_ais === null ? '—' : Math.round(result.current_ais)}
                            </div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                                AIS SCORE
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                         <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>VERIFICATION</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#60a5fa' }}>{result.verification_tier}</div>
                         </div>
                         <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>TRUST LEVEL</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--gold)' }}>{result.trust_level}</div>
                         </div>
                    </div>

                </div>
            )}

            {!result && !error && !isLoading && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Look up any registered agent by DID or address (e.g. did:integrity:...). No separate XNS handle registry exists yet.
                </div>
            )}
        </div>
    );
};
