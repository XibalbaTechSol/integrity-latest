const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const routes = ['/', '/agents', '/markets', '/chain-of-thought'];
  
  for (const route of routes) {
    console.log(`Taking screenshot for ${route}`);
    await page.goto(`http://localhost:5174${route}`);
    await page.waitForTimeout(2000); // wait for rendering
    const safeRoute = route === '/' ? 'home' : route.replace('/', '');
    await page.screenshot({ path: path.join(__dirname, '..', '.gemini/antigravity/brain/b857fb13-bba3-48fe-9b68-4ab47db4fb3c/artifacts', `${safeRoute}.png`), fullPage: true });
  }

  await browser.close();
  console.log("Done");
})();
