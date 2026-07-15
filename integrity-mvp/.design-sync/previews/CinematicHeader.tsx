import { CinematicHeader } from 'integrity-mvp';

// A fixed-position overlay header designed for a dark hero backdrop
// (background is transparent until scrolled) — wrap in dark so its
// white/light text and logo don't wash out against the card harness's
// white chrome.
export const Default = () => (
  <div style={{ position: 'relative', height: '120px', background: 'var(--bg-main)' }}>
    <CinematicHeader />
  </div>
);
