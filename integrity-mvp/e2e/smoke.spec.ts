import { test, expect } from '@playwright/test';

const ROUTES = [
    '/', '/landing', '/identity', '/contracts', '/cognition', '/settings',
    '/telemetry', '/exchange', '/chain-of-thought', '/compare-traces',
    '/finance', '/intelligence', '/shield', '/agents', '/documents', '/audit',
];

test.describe('every route renders without a console/page error', () => {
    for (const route of ROUTES) {
        test(`GET ${route}`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (err) => errors.push(err.message));
            page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

            await page.goto(route, { waitUntil: 'networkidle' });
            expect(errors, `console/page errors on ${route}: ${errors.join('; ')}`).toEqual([]);
        });
    }
});

test('AgentsPage shows real oracle data, not the old hardcoded fixture', async ({ page }) => {
    const responses: string[] = [];
    page.on('response', async (res) => {
        if (res.url().includes('/v1/agents')) responses.push(await res.text());
    });

    await page.goto('/agents', { waitUntil: 'networkidle' });

    // The page must have actually called the real oracle endpoint — this
    // is the check that catches "builds fine but never fetches" regressions
    // that a pure DOM assertion alone would miss.
    expect(responses.length).toBeGreaterThan(0);

    const bodyText = await page.locator('body').innerText();
    // Old hardcoded fixture DIDs this page must never show again.
    expect(bodyText).not.toContain('did:intg:0x7a2...f89c');
});

test('wallet connect button is present in the shell', async ({ page }) => {
    await page.goto('/agents', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /connect wallet|no wallet found/i })).toBeVisible();
});
