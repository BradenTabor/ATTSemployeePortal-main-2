/**
 * Capture Chrome DevTools trace and CPU profile
 * Usage: node scripts/capture-trace.mjs <url> [outputPrefix]
 */
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { setTimeout as delay } from 'timers/promises';

const url = process.argv[2] || 'http://localhost:5000';
const prefix = process.argv[3] || 'baseline';

async function captureTraceAndProfile() {
  console.log(`Starting trace capture for ${url}...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set up CDP session for CPU profiling
  const client = await page.target().createCDPSession();
  
  // Start tracing
  await page.tracing.start({
    path: `${prefix}-trace.json`,
    categories: ['devtools.timeline', 'v8.execute', 'blink.user_timing', 'loading', 'disabled-by-default-devtools.timeline']
  });
  
  // Start CPU profiler
  await client.send('Profiler.enable');
  await client.send('Profiler.start');
  
  console.log('Navigating to page...');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  // Wait for the app to stabilize
  await delay(3000);
  
  // Simulate some interaction - scroll the page
  console.log('Simulating user interactions...');
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await delay(1000);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await delay(1000);
  
  // Stop profilers
  const { profile } = await client.send('Profiler.stop');
  await page.tracing.stop();
  
  // Save CPU profile
  writeFileSync(`${prefix}-cpu.profile`, JSON.stringify(profile, null, 2));
  
  console.log(`Saved: ${prefix}-trace.json and ${prefix}-cpu.profile`);
  
  await browser.close();
}

captureTraceAndProfile().catch(err => {
  console.error('Error capturing trace:', err);
  process.exit(1);
});

