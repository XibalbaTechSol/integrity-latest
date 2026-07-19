import React from 'react';
import { Activity, ShieldCheck, Lock } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import { oracle } from '../../services/oracle';
import { useAgent } from '../../contexts/AgentContext';
import { SeededDataBadge } from '../../shared/SeededDataBadge';

// PRODUCTION_GAPS.md: this widget used to badge itself "LIVE MODEL" while
// every number on it was hardcoded (avgAis picked from 3 magic constants,
// blockedRate/riskExposure literal strings, all 3 sparklines fabricated
// trend arrays) -- the most severe fake-data surface left in the dashboard,
// since every sibling widget in WidgetRegistry.tsx either fetches real data
// or discloses via SeededDataBadge, and this one did neither.
//
// Metrics 1 and 2 below are now real, network-wide averages fanned out from
// oracle.getAis() across every registered agent (AgentContext already holds
// that list globally) -- same fan-out pattern DashboardPage.tsx already
// uses to drive the "gauge" widget's real aisDistribution/highIntegrityPct.
// Metric 3 stays honestly undisclosed: no probability-of-leak model and no
// network-wide "list every active BAA's staked collateral" index exists
// anywhere in this monorepo (ShieldPage/IdentityPage independently found
// the same gap for Slasher stake data -- see their own "not wired yet"
// disclosures) -- inventing a number for it would be exactly the kind of
// fabrication this fix removes from the other two metrics.

interface AgentAisSample {
    ais: number;
    compliance: number;
}

// Hoisted to module scope, deliberately -- these were originally defined as
// local consts inside the widget body, which meant React saw a brand-new
// component TYPE on every render and fully unmounted+remounted (re-parsed)
// all 3 KaTeX formulas every single time the widget re-rendered. Harmless
// when the widget was static, but combined with the polling-driven
// re-renders DashboardPage already produces (SSE `latestAis` updates) plus
// this widget's own new fetch-driven state updates, that remount-per-render
// pattern turned into a real render-thrashing bug (observed: KaTeX's
// mathVsTextAccents warning flooding the console multiple times per
// second, freezing the tab). Static content has no reason to remount.
const AisFormula = () => (
    <div 
        style={{ padding: '8px 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ 
            __html: katex.renderToString("\\Delta_{\\text{AIS}} = 1 - \\left( \\sum w_i S_i \\right) \\times \\text{ZK}_{\\text{boost}}", { displayMode: true, throwOnError: false }) 
        }} 
    />
);

const BccFormula = () => (
    <div 
        style={{ padding: '8px 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ 
            __html: katex.renderToString("\\rho_{\\text{BCC}} = \\left( \\frac{N_{\\text{blocked}}}{N_{\\text{total}}} \\right) \\times 100", { displayMode: true, throwOnError: false }) 
        }} 
    />
);

const ExposureFormula = () => (
    <div 
        style={{ padding: '8px 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ 
            __html: katex.renderToString("E_{\\text{risk}} = \\int P(\\text{leak}) \\cdot C_{\\text{staked}} \\, dt", { displayMode: true, throwOnError: false }) 
        }} 
    />
);

export const TriMetricWidget: React.FC = () => {
    const { agents } = useAgent();
    const [samples, setSamples] = React.useState<AgentAisSample[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (agents.length === 0) {
            // Guard against an unnecessary state update (and the re-render
            // it would trigger) when there's genuinely nothing to change --
            // a fresh `[]` literal is a new reference every call, and
            // setState bails out on identical state only by reference
            // equality, not by value.
            setSamples((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        let cancelled = false;
        setLoading(true);
        Promise.all(
            agents.map((a) =>
                oracle.getAis(a.id).then(
                    (res): AgentAisSample | null => ({ ais: res.ais, compliance: res.components.compliance }),
                    () => null // agent has no AIS yet (no telemetry) -- excluded, not zeroed
                )
            )
        ).then((results) => {
            if (cancelled) return;
            const real = results.filter((r): r is AgentAisSample => r !== null);
            setSamples(real);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [agents]);

    const avgAis = samples.length > 0 ? samples.reduce((sum, s) => sum + s.ais, 0) / samples.length : null;
    const avgCompliance =
        samples.length > 0 ? samples.reduce((sum, s) => sum + s.compliance, 0) / samples.length : null;

    const deficitPct = avgAis !== null ? (((1000 - avgAis) / 1000) * 100).toFixed(1) : null;
    // S_compliance is (1 - flagged_ratio) * 1000 (scoring-core's own
    // polarity), so inverting it back out recovers the real flagged/blocked
    // ratio -- the exact quantity rho_BCC's formula names, not a proxy.
    const violationRate = avgCompliance !== null ? (((1000 - avgCompliance) / 1000) * 100).toFixed(2) : null;

    return (
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} color="var(--primary)" />
                    Tri-Metric Risk Analysis
                </h3>
                {samples.length > 0 && (
                    <span className="badge badge-success" style={{ boxShadow: '0 0 10px rgba(16,185,129,0.3)' }}>
                        {samples.length} AGENT{samples.length === 1 ? '' : 'S'} LIVE
                    </span>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', flex: 1 }}>
                {/* AIS Deficit */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <ShieldCheck size={16} color="var(--gold)" /> Agent Integrity Score Deficit
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <AisFormula />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                            <span>{deficitPct !== null ? `${deficitPct}%` : loading ? '…' : '—'}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600, textAlign: 'right' }}>
                            {samples.length > 0 ? `Avg over ${samples.length} agent${samples.length === 1 ? '' : 's'}` : 'No AIS data yet'}
                        </div>
                    </div>
                </div>

                {/* BCC Violation Rate */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <Lock size={16} color="var(--danger)" /> BCC Intent Violation Rate
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <BccFormula />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: 'var(--danger)', textShadow: '0 4px 10px rgba(244,63,94,0.3)' }}>
                            <span>{violationRate !== null ? `${violationRate}%` : loading ? '…' : '—'}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600, textAlign: 'right' }}>
                            Reporting-period avg
                        </div>
                    </div>
                </div>

                {/* Collateral Risk -- honestly undisclosed, see module docstring */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <Activity size={16} color="var(--primary)" /> Smart BAA Value at Risk <SeededDataBadge label="No risk model exists" />
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <ExposureFormula />
                        </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Not available — no probability-of-leak model or network-wide staked-collateral
                            index exists yet (see PRODUCTION_GAPS.md). Per-BAA collateral is readable
                            on-chain (SmartBAA.requiredCollateral), but nothing aggregates it across the
                            network today.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
