import { TriMetricWidget } from 'integrity-mvp';

// These cards use a translucent-on-dark surface (rgba(255,255,255,0.02) etc.)
// designed to sit on the app's dark page shell — wrap in that background so
// the preview matches how it actually renders in the dashboard, not the
// card harness's neutral white chrome.
const dark = (node: React.ReactNode) => (
  <div style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '8px' }}>{node}</div>
);

export const Default = () => dark(<TriMetricWidget />);

export const HighIntegrity = () => dark(<TriMetricWidget highIntegrityPct={92} />);
