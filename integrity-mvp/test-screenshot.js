import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000); // Wait for animations
  await page.screenshot({ path: '/home/xibalba/.gemini/antigravity/brain/98865371-0ab6-4236-9359-129dfd878526/artifacts/screenshot_math.png', fullPage: true });
  await browser.close();
  console.log('Screenshot taken!');
})();
