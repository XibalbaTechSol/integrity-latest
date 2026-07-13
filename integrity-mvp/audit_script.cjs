const puppeteer = require('puppeteer');
const fs = require('fs');

const ROUTES = [
  '/', 
  '/exchange', 
  '/finance', 
  '/intelligence', 
  '/shield', 
  '/agents', 
  '/documents', 
  '/audit', 
  '/identity', 
  '/contracts', 
  '/cognition', 
  '/settings'
];

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.setViewport({ width: 1280, height: 800 });

  if (!fs.existsSync('audit_screenshots')) {
    fs.mkdirSync('audit_screenshots');
  }

  for (const route of ROUTES) {
    const url = `http://localhost:5173${route}`;
    console.log(`Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      // wait a bit for animations or charts
      await new Promise(r => setTimeout(r, 1000));
      
      const fileName = `audit_screenshots/${route === '/' ? 'home' : route.substring(1)}.png`;
      await page.screenshot({ path: fileName, fullPage: true });
      console.log(`Saved screenshot: ${fileName}`);
    } catch (e) {
      console.error(`Failed on ${route}: ${e.message}`);
    }
  }

  await browser.close();
  console.log("Done.");
})();
