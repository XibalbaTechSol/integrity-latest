import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Users, Cpu } from 'lucide-react';

// Exact ports of integrity-oracle/scoring-core/src/lib.rs's three component-score
// functions -- not illustrative approximations. Keep these in sync with that file;
// if the Rust formulas change, these must change too (see that crate's own doc
// comment: "this crate is the ONLY place the AIS formula is computed" -- these plots
// are a client-side re-derivation for display purposes only, never a second source
// of truth the oracle itself reads from).
const MAX_COMPONENT_SCORE = 1000;

function sEntropy(performanceVariance: number): number {
    const v = Math.max(performanceVariance, 0);
    const stabilityFactor = Math.exp(-1.5 * v * v);
    return Math.min(Math.max(stabilityFactor * MAX_COMPONENT_SCORE, 0), MAX_COMPONENT_SCORE);
}

function sGrounding(hgiRaw: number): number {
    const h = Math.min(Math.max(hgiRaw, 0), 1);
    return h * MAX_COMPONENT_SCORE;
}

function sSacrifice(gpuHoursVerified: number): number {
    const hours = Math.max(gpuHoursVerified, 0);
    const sacrificeIdx = Math.min(Math.log10(hours + 1) / 3, 1);
    return sacrificeIdx * MAX_COMPONENT_SCORE;
}

const entropyData = Array.from({ length: 41 }, (_, i) => {
    const variance = i * 0.05; // 0 -> 2.0
    return { x: variance, score: sEntropy(variance) };
});

const groundingData = Array.from({ length: 21 }, (_, i) => {
    const hgi = i * 0.05; // 0 -> 1.0
    return { x: hgi, score: sGrounding(hgi) };
});

const sacrificeData = Array.from({ length: 41 }, (_, i) => {
    const hours = i * 25; // 0 -> 1000 verified hours
    return { x: hours, score: sSacrifice(hours) };
});

interface FunctionCardProps {
    icon: React.ReactNode;
    accent: string;
    title: string;
    formula: string;
    data: { x: number; score: number }[];
    xLabel: string;
    caption: string;
    xTickFormatter?: (v: number) => string;
}

const FunctionCard = ({ icon, accent, title, formula, data, xLabel, caption, xTickFormatter }: FunctionCardProps) => (
    <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: accent }}>
            {icon}
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>{title}</h3>
        </div>
        <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.5)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.05rem', color: accent }}>
            <BlockMath math={formula} />
        </div>
        <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                        dataKey="x"
                        stroke="var(--text-muted)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={xTickFormatter}
                        label={{ value: xLabel, position: 'insideBottom', offset: -4, fontSize: 11, fill: 'var(--text-muted)' }}
                    />
                    <YAxis domain={[0, 1000]} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                        labelFormatter={(v) => `x = ${v}`}
                        formatter={(value) => [Number(value).toFixed(1), 'Score']}
                    />
                    <Line type="monotone" dataKey="score" stroke={accent} strokeWidth={2.5} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{caption}</p>
    </div>
);

export const TriMetricFunctions = () => (
    <section>
        <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>The Real Math</div>
        <h2 style={{ fontSize: '2.8rem', fontFamily: 'inherit', marginBottom: '24px', lineHeight: 1.1 }}>How The Integrity Score Actually Behaves</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '48px', maxWidth: '800px' }}>
            The Agent Integrity Score isn&apos;t a black box &mdash; it&apos;s a weighted sum of three closed-form functions,
            each chosen for a specific curve shape. These are the exact formulas <code>integrity-oracle</code> computes
            today, not marketing illustrations. Sacrifice is genuinely a function of elapsed, verified compute-time;
            entropy and grounding are recomputed every reporting period from an agent&apos;s live behavior, plotted here
            against their own real defining signal.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <FunctionCard
                icon={<Activity size={24} />}
                accent="var(--primary)"
                title="Entropy — Behavioral Stability"
                formula={String.raw`S_{\text{entropy}}(v) = 1000 \cdot e^{-1.5v^2}`}
                data={entropyData}
                xLabel="Performance variance (v)"
                caption="A Gaussian decay: small variance barely moves the score, but instability compounds fast and saturates toward zero rather than going negative — a stable agent is rewarded disproportionately over an erratic one."
            />
            <FunctionCard
                icon={<Users size={24} />}
                accent="var(--gold)"
                title="Grounding — Human Oversight"
                formula={String.raw`S_{\text{grounding}}(h) = 1000 \cdot \text{clamp}(h, 0, 1)`}
                data={groundingData}
                xLabel="Human-grounding fraction (h)"
                caption="Directly proportional, by design — there's no principled nonlinearity here. An agent checked against human feedback 80% of the time scores exactly 800; no curve to game."
            />
            <FunctionCard
                icon={<Cpu size={24} />}
                accent="var(--success)"
                title="Sacrifice — Verified Compute-Time"
                formula={String.raw`S_{\text{sacrifice}}(t) = 1000 \cdot \min\!\left(\frac{\log_{10}(t+1)}{3},\ 1\right)`}
                data={sacrificeData}
                xLabel="Verified compute-hours elapsed (t)"
                xTickFormatter={(v) => `${v}h`}
                caption="Logarithmic, saturating at 1000 verified hours. Early contributions matter a lot; a whale contributing 100× the compute of a baseline agent does not score 100× higher — this stays a trust signal, not pay-to-win."
            />
        </div>
    </section>
);
