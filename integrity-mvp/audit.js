import { chromium } from 'playwright';

const ROUTES = [
  '/',
  '/landing',
  '/identity',
  '/contracts',
  '/cognition',
  '/settings',
  '/telemetry',
  '/exchange',
  '/chain-of-thought',
  '/compare-traces',
  '/finance',
  '/intelligence',
  '/shield',
  '/agents',
  '/documents',
  '/audit'
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  for (const route of ROUTES) {
    console.log(`Navigating to ${route}...`);
    try {
      await page.goto(`http://localhost:5174${route}`, { waitUntil: 'networkidle', timeout: 5000 });
      // Clean up the name for the file
      const name = route === '/' ? 'dashboard' : route.substring(1);
      const filename = `/home/xibalba/.gemini/antigravity/brain/98865371-0ab6-4236-9359-129dfd878526/artifacts/screenshot_${name}.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);
    } catch (e) {
      console.error(`Failed on ${route}: ${e.message}`);
    }
  }

  await browser.close();
})();
