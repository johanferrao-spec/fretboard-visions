import { chromium } from '@playwright/test';
import fs from 'node:fs';

const outDir = '/mnt/documents/audio-verification';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium-browser', args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1373, height: 881 }, recordVideo: { dir: outDir, size: { width: 1373, height: 881 } } });
await context.addInitScript(() => {
  const originalConnect = AudioNode.prototype.connect;
  const probes = new WeakMap();
  window.__audioProbe = { rms: 0, peak: 0, connections: 0, samples: 0, lastError: null };
  function ensureProbe(ctx) {
    let probe = probes.get(ctx);
    if (probe) return probe;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const data = new Uint8Array(analyser.fftSize);
    probe = { analyser, data };
    probes.set(ctx, probe);
    const tick = () => {
      try {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        let peak = 0;
        for (const v of data) {
          const x = (v - 128) / 128;
          sum += x * x;
          peak = Math.max(peak, Math.abs(x));
        }
        window.__audioProbe.rms = Math.sqrt(sum / data.length);
        window.__audioProbe.peak = Math.max(window.__audioProbe.peak, peak);
        window.__audioProbe.samples += 1;
      } catch (e) {
        window.__audioProbe.lastError = String(e);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return probe;
  }
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = originalConnect.call(this, destination, ...args);
    try {
      if (destination instanceof AudioDestinationNode) {
        const probe = ensureProbe(this.context);
        originalConnect.call(this, probe.analyser);
        window.__audioProbe.connections += 1;
      }
    } catch (e) {
      window.__audioProbe.lastError = String(e);
    }
    return result;
  };
});
const page = await context.newPage();
page.on('console', msg => { const t = msg.text(); if (/\[(backing|metronome)\]|AudioContext|error|warn/i.test(t) && !/Function components cannot be given refs/.test(t)) console.log(`[browser:${msg.type()}]`, t); });
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const metronome = page.getByTitle(/Metronome OFF/i);
await metronome.click();
await page.waitForTimeout(1600);
const metroProbe = await page.evaluate(() => ({ ...window.__audioProbe, tone: window.Tone?.getContext?.().state ?? 'unknown' }));
console.log('METRONOME_PROBE', JSON.stringify(metroProbe));
await page.getByTitle(/Metronome ON/i).click().catch(() => {});
await page.waitForTimeout(250);

await page.mouse.dblclick(520, 800);
await page.waitForTimeout(350);
await page.getByRole('button', { name: '🎹 Backing Track' }).click();
await page.waitForTimeout(700);
await page.getByTitle('Play').click();
await page.waitForTimeout(2200);
const backingProbe = await page.evaluate(() => ({ ...window.__audioProbe, tone: window.Tone?.getContext?.().state ?? 'unknown' }));
console.log('BACKING_PROBE', JSON.stringify(backingProbe));
await page.screenshot({ path: `${outDir}/audio-verification.png`, fullPage: true });
await context.close();
await browser.close();
const videos = fs.readdirSync(outDir).filter(f => f.endsWith('.webm'));
if (videos.length) {
  fs.renameSync(`${outDir}/${videos[0]}`, '/mnt/documents/audio-verification.webm');
  console.log('VIDEO /mnt/documents/audio-verification.webm');
}
console.log('SCREENSHOT /mnt/documents/audio-verification/audio-verification.png');
