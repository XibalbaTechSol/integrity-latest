import { SandboxConsole } from 'integrity-mvp';

// The "Live Output" panel uses a translucent-on-dark surface designed to sit
// on the app's dark page shell — wrap in that background so it doesn't wash
// out against the card harness's white chrome.
export const Default = () => (
  <div style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '8px' }}>
    <SandboxConsole />
  </div>
);
