import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1373, height: 881 } });
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
console.log('title', await page.title());
console.log('buttons', await page.locator('button').evaluateAll(btns => btns.slice(0, 30).map(b => b.textContent?.trim())));
await browser.close();
