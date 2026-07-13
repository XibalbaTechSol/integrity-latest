import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { Activity, ShieldCheck, Lock } from 'lucide-react';

interface TriMetricWidgetProps {
    aisDistribution?: { name: string; count: number; fill: string }[] | null;
    highIntegrityPct?: number | null;
}

export const TriMetricWidget: React.FC<TriMetricWidgetProps> = ({ highIntegrityPct }) => {
    // Metric 1: AIS Deficit
    const aisFormula = katex.renderToString("\\Delta_{AIS} = 1 - \\left( \\sum_{i=1}^{4} w_i S_i \\right) \\times ZK_{boost}", { throwOnError: false, displayMode: true });
    
    // Metric 2: BCC Intent Violation Rate
    const bccFormula = katex.renderToString("\\rho_{BCC} = \\frac{N_{blocked}}{N_{total}} \\times 100", { throwOnError: false, displayMode: true });
    
    // Metric 3: Collateral Exposure Risk
    const exposureFormula = katex.renderToString("E_{risk} = \\int_{0}^{t} P(leak) \\cdot C_{staked} \\, dt", { throwOnError: false, displayMode: true });

    // Mock live values derived from global metrics
    const avgAis = highIntegrityPct ? (highIntegrityPct > 80 ? 920 : 850) : 950;
    const deficitPct = ((1000 - avgAis) / 1000 * 100).toFixed(1);
    const blockedRate = "0.42";
    const riskExposure = "12,500";
    
    const renderInline = (tex: string) => katex.renderToString(tex, { throwOnError: false, displayMode: false });

    return (
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} color="var(--primary)" />
                    Tri-Metric Risk Analysis
                </h3>
                <span className="badge badge-success">LIVE MODEL</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', flex: 1 }}>
                
                {/* AIS Deficit */}
                <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>
                            <ShieldCheck size={14} /> Agent Integrity Score Deficit
                        </div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--gold)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <div dangerouslySetInnerHTML={{ __html: aisFormula }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }} dangerouslySetInnerHTML={{ __html: renderInline(`\\mathbf{${deficitPct}\\%}`) }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Global Network Avg</div>
                    </div>
                </div>

                {/* BCC Violation Rate */}
                <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>
                            <Lock size={14} /> BCC Intent Violation Rate
                        </div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--danger)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <div dangerouslySetInnerHTML={{ __html: bccFormula }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--danger)' }} dangerouslySetInnerHTML={{ __html: renderInline(`\\mathbf{${blockedRate}\\%}`) }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rolling 24h</div>
                    </div>
                </div>

                {/* Collateral Risk */}
                <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>
                            <Activity size={14} /> Smart BAA Value at Risk
                        </div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--primary)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <div dangerouslySetInnerHTML={{ __html: exposureFormula }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--primary)' }} dangerouslySetInnerHTML={{ __html: renderInline(`\\mathbf{${riskExposure.replace(',', '\\,')}}`) }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ITK Staked</div>
                    </div>
                </div>

            </div>
        </div>
    );
};
