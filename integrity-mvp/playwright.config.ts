import { defineConfig } from '@playwright/test';

// Requires a real backend stack running (anvil + a registered agent +
// integrity-oracle at VITE_ORACLE_URL, default http://localhost:8080 — see
// integrity-mvp's README for the local dev setup). Not a mocked-network
// suite: this checks the built app renders real data with zero console
// errors, matching this repo's own "no silent mocks" testing philosophy.
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    webServer: {
        command: 'npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 30_000,
    },
    use: {
        baseURL: 'http://localhost:4173',
    },
});
