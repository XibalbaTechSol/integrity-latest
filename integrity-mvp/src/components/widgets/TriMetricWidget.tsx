import React from 'react';
import { Activity, ShieldCheck, Lock } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface TriMetricWidgetProps {
    aisDistribution?: { name: string; count: number; fill: string }[] | null;
    highIntegrityPct?: number | null;
}

export const TriMetricWidget: React.FC<TriMetricWidgetProps> = ({ highIntegrityPct }) => {
    // Metric 1: AIS Deficit
    const AisFormula = () => (
        <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            &Delta;<sub>AIS</sub> = 1 - (&sum; w<sub>i</sub> S<sub>i</sub>) &times; ZK<sub>boost</sub>
        </div>
    );
    
    // Metric 2: BCC Intent Violation Rate
    const BccFormula = () => (
        <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            &rho;<sub>BCC</sub> = (N<sub>blocked</sub> / N<sub>total</sub>) &times; 100
        </div>
    );
    
    // Metric 3: Collateral Exposure Risk
    const ExposureFormula = () => (
        <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            E<sub>risk</sub> = &int; P(leak) &middot; C<sub>staked</sub> dt
        </div>
    );

    // Mock live values derived from global metrics
    const avgAis = highIntegrityPct ? (highIntegrityPct > 80 ? 920 : 850) : 950;
    const deficitPct = ((1000 - avgAis) / 1000 * 100).toFixed(1);
    const blockedRate = "0.42";
    const riskExposure = "12,500";
    // Miniature sparkline mock data
    const aisSparkline = [{v: 900}, {v: 920}, {v: 910}, {v: 940}, {v: avgAis}];
    const bccSparkline = [{v: 0.5}, {v: 0.6}, {v: 0.45}, {v: 0.48}, {v: 0.42}];
    const exposureSparkline = [{v: 11000}, {v: 11500}, {v: 12000}, {v: 12200}, {v: 12500}];

    return (
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} color="var(--primary)" />
                    Tri-Metric Risk Analysis
                </h3>
                <span className="badge badge-success" style={{ boxShadow: '0 0 10px rgba(16,185,129,0.3)' }}>LIVE MODEL</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', flex: 1 }}>
                
                {/* AIS Deficit */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    {/* Sparkline background */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', opacity: 0.4, pointerEvents: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={aisSparkline}>
                                <Area type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={2} fillOpacity={0.2} fill="var(--gold)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <ShieldCheck size={16} color="var(--gold)" /> Agent Integrity Score Deficit
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <AisFormula />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                            <span>{deficitPct}%</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>Global Network Avg</div>
                    </div>
                </div>

                {/* BCC Violation Rate */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', opacity: 0.4, pointerEvents: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={bccSparkline}>
                                <Area type="monotone" dataKey="v" stroke="var(--danger)" strokeWidth={2} fillOpacity={0.2} fill="var(--danger)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <Lock size={16} color="var(--danger)" /> BCC Intent Violation Rate
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <BccFormula />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: 'var(--danger)', textShadow: '0 4px 10px rgba(244,63,94,0.3)' }}>
                            <span>{blockedRate}%</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>Rolling 24h</div>
                    </div>
                </div>

                {/* Collateral Risk */}
                <div style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px -10px rgba(0,0,0,0.5)' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', opacity: 0.4, pointerEvents: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={exposureSparkline}>
                                <Area type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} fillOpacity={0.2} fill="var(--primary)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            <Activity size={16} color="var(--primary)" /> Smart BAA Value at Risk
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'rgba(255,255,255,0.4)', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }} className="custom-scrollbar">
                            <ExposureFormula />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: 'var(--primary)', textShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                            <span>{riskExposure}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>ITK Staked</div>
                    </div>
                </div>

            </div>
        </div>
    );
};
