const { chromium } = require('playwright');
const fs = require('fs');

const ROUTES = [
  'identity', 'contracts', 'cognition', 'settings', 
  'telemetry', 'exchange', 'chain-of-thought', 
  'compare-traces', 'finance', 'intelligence', 
  'shield', 'agents', 'documents', 'audit'
];

(async () => {
  if (!fs.existsSync('audit_screenshots')) {
    fs.mkdirSync('audit_screenshots');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });

  console.log('Starting visual audit with Playwright...');

  for (const route of ROUTES) {
    console.log(`Auditing /${route}...`);
    try {
      await page.goto(`http://localhost:5173/${route}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `audit_screenshots/${route}.png`, fullPage: true });
    } catch (e) {
      console.error(`Error auditing /${route}:`, e);
    }
  }

  await browser.close();
  console.log('Audit complete. Screenshots saved to audit_screenshots/');
})();
