#!/usr/bin/env node
/**
 * Performance Profiling Script for ATTS Employee Portal
 * 
 * Captures Chrome DevTools traces, CPU profiles, heap snapshots, and Lighthouse reports
 * for comprehensive performance analysis.
 * 
 * Usage:
 *   node scripts/performance-profiling.mjs [options]
 * 
 * Options:
 *   --email=<email>     Test user email for login
 *   --password=<pass>   Test user password for login
 *   --skip-login        Skip login-required flows (test public pages only)
 *   --warmup=<n>        Number of warmup runs (default: 2)
 *   --headless          Run in headless mode (default: true)
 *   --visible           Run with browser visible
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'performance-report', 'artifacts');

// Configuration
const BASE_URL = 'http://127.0.0.1:4173';
const WARMUP_RUNS = 2;
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 2.625, isMobile: true };

// Parse command line arguments
function parseArgs() {
  const args = {
    email: process.env.TEST_EMAIL || null,
    password: process.env.TEST_PASSWORD || null,
    skipLogin: false,
    warmupRuns: WARMUP_RUNS,
    headless: true,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--email=')) {
      args.email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      args.password = arg.split('=')[1];
    } else if (arg === '--skip-login') {
      args.skipLogin = true;
    } else if (arg.startsWith('--warmup=')) {
      args.warmupRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--visible') {
      args.headless = false;
    } else if (arg === '--headless') {
      args.headless = true;
    }
  }

  return args;
}

// Ensure directories exist
function ensureDirectories() {
  const dirs = [
    path.join(ARTIFACTS_DIR, 'traces'),
    path.join(ARTIFACTS_DIR, 'cpu-profiles'),
    path.join(ARTIFACTS_DIR, 'heap-snapshots'),
    path.join(ARTIFACTS_DIR, 'lighthouse'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to wait for network idle
async function waitForNetworkIdle(page, timeout = 5000) {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout });
  } catch (e) {
    // Network may not be completely idle, continue
  }
}

// Helper to simulate scroll
async function simulateScroll(page, scrolls = 5) {
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
    });
    await new Promise(r => setTimeout(r, 300));
  }
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 200));
}

// Helper to start tracing
async function startTracing(page, name) {
  const tracePath = path.join(ARTIFACTS_DIR, 'traces', `${name}.trace.json`);
  await page.tracing.start({
    path: tracePath,
    screenshots: true,
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-v8.cpu_profiler',
      'disabled-by-default-v8.cpu_profiler.hires',
      'blink.user_timing',
      'loading',
      'v8.execute',
      'v8',
    ],
  });
  return tracePath;
}

// Helper to stop tracing and return path
async function stopTracing(page) {
  await page.tracing.stop();
}

// Helper to capture CPU profile via CDP
async function captureCPUProfile(client, name, durationMs = 3000) {
  await client.send('Profiler.enable');
  await client.send('Profiler.start');
  await new Promise(r => setTimeout(r, durationMs));
  const { profile } = await client.send('Profiler.stop');
  await client.send('Profiler.disable');
  
  const profilePath = path.join(ARTIFACTS_DIR, 'cpu-profiles', `${name}.cpuprofile`);
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  return profilePath;
}

// Helper to capture heap snapshot
async function captureHeapSnapshot(client, name) {
  const chunks = [];
  client.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => {
    chunks.push(chunk);
  });
  
  await client.send('HeapProfiler.enable');
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await client.send('HeapProfiler.disable');
  
  const snapshotPath = path.join(ARTIFACTS_DIR, 'heap-snapshots', `${name}.heapsnapshot`);
  fs.writeFileSync(snapshotPath, chunks.join(''));
  return snapshotPath;
}

// Login flow
async function performLogin(page, email, password) {
  console.log('  🔐 Performing login...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await waitForNetworkIdle(page);
  
  // Wait for login form
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    
    // Find and click sign in button
    const signInButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.toLowerCase().includes('sign in')) || null;
    });
    
    if (signInButton) {
      await signInButton.click();
      await new Promise(r => setTimeout(r, 2000));
      await waitForNetworkIdle(page);
      
      // Check if redirected to dashboard
      const url = page.url();
      if (url.includes('/dashboard') || url.includes('/mechanic')) {
        console.log('  ✅ Login successful');
        return true;
      }
    }
    
    console.log('  ⚠️ Login may have failed, continuing with limited access');
    return false;
  } catch (e) {
    console.log('  ⚠️ Could not find login form, may already be logged in or session restored');
    return false;
  }
}

// Flow definitions
const FLOWS = {
  'home-load': {
    name: 'Home Page Load',
    requiresAuth: false,
    async run(page) {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
    }
  },
  
  'dashboard': {
    name: 'Dashboard',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 4);
      // Interact with expandable sections if present
      const expandables = await page.$$('[data-expandable]');
      for (const el of expandables.slice(0, 2)) {
        try {
          await el.click();
          await new Promise(r => setTimeout(r, 500));
        } catch {}
      }
    }
  },
  
  'forms': {
    name: 'Forms Page',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/forms`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
    }
  },
  
  'announcements': {
    name: 'Announcements',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/announcements`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 5);
    }
  },
  
  'admin-users': {
    name: 'Admin Users',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
    }
  },
  
  'admin-rto': {
    name: 'Admin RTO',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/admin/rto`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
    }
  },
  
  'mechanic-dvir-center': {
    name: 'Mechanic DVIR Center',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/mechanic-dvir-center`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
    }
  },
  
  'dvir-form': {
    name: 'DVIR Form',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/dashboard/forms/dvir`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      await simulateScroll(page, 3);
      // Try interacting with form fields
      const selects = await page.$$('select');
      for (const select of selects.slice(0, 2)) {
        try {
          await select.click();
          await new Promise(r => setTimeout(r, 200));
        } catch {}
      }
    }
  },
  
  'navigation-stress': {
    name: 'Navigation Stress Test',
    requiresAuth: true,
    async run(page) {
      const routes = ['/dashboard', '/forms', '/announcements', '/resources', '/contact'];
      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 500));
      }
    }
  },
  
  'scroll-stress': {
    name: 'Scroll Stress Test',
    requiresAuth: true,
    async run(page) {
      await page.goto(`${BASE_URL}/announcements`, { waitUntil: 'networkidle0' });
      await waitForNetworkIdle(page);
      // Rapid scrolling
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise(r => setTimeout(r, 100));
      }
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, -300));
        await new Promise(r => setTimeout(r, 100));
      }
    }
  },
};

// Run Lighthouse audit
async function runLighthouse(url, outputPath, isMobile = true) {
  // Dynamic import lighthouse
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  
  console.log(`  🔦 Running Lighthouse (${isMobile ? 'mobile' : 'desktop'})...`);
  
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  
  try {
    const options = {
      logLevel: 'error',
      output: 'json',
      port: chrome.port,
      formFactor: isMobile ? 'mobile' : 'desktop',
      screenEmulation: isMobile ? {
        mobile: true,
        width: 375,
        height: 812,
        deviceScaleFactor: 2.625,
        disabled: false,
      } : {
        mobile: false,
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        disabled: false,
      },
      throttling: isMobile ? undefined : {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
      },
    };

    const result = await lighthouse(url, options);
    fs.writeFileSync(outputPath, JSON.stringify(result.lhr, null, 2));
    console.log(`  ✅ Lighthouse report saved: ${path.basename(outputPath)}`);
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

// Main execution
async function main() {
  console.log('\n🚀 ATTS Employee Portal - Performance Profiling\n');
  console.log('=' .repeat(60));
  
  const args = parseArgs();
  ensureDirectories();
  
  if (!args.email || !args.password) {
    if (!args.skipLogin) {
      console.log('\n⚠️  No login credentials provided.');
      console.log('   Provide credentials via:');
      console.log('     --email=<email> --password=<password>');
      console.log('   Or environment variables:');
      console.log('     TEST_EMAIL=<email> TEST_PASSWORD=<password>');
      console.log('   Or skip auth flows with: --skip-login\n');
      console.log('   Running with --skip-login mode...\n');
      args.skipLogin = true;
    }
  }
  
  // Check if server is running
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Server not responding');
  } catch (e) {
    console.error(`❌ Server not running at ${BASE_URL}`);
    console.error('   Start with: npm run preview:ci');
    process.exit(1);
  }
  
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔧 Headless: ${args.headless}`);
  console.log(`🔄 Warmup runs: ${args.warmupRuns}`);
  console.log(`🔐 Auth: ${args.skipLogin ? 'Skipped' : 'Enabled'}\n`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: args.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  
  // Get CDP session for advanced profiling
  const client = await page.target().createCDPSession();
  
  // Enable performance monitoring
  await client.send('Performance.enable');
  
  let isLoggedIn = false;
  
  // Perform login if credentials provided
  if (!args.skipLogin && args.email && args.password) {
    isLoggedIn = await performLogin(page, args.email, args.password);
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      warmupRuns: args.warmupRuns,
      skipLogin: args.skipLogin,
      isLoggedIn,
    },
    flows: {},
    artifacts: {
      traces: [],
      cpuProfiles: [],
      heapSnapshots: [],
      lighthouse: [],
    },
  };
  
  // Run each flow
  for (const [flowId, flow] of Object.entries(FLOWS)) {
    console.log(`\n📊 Flow: ${flow.name}`);
    console.log('-'.repeat(40));
    
    // Skip auth-required flows if not logged in
    if (flow.requiresAuth && !isLoggedIn && !args.skipLogin) {
      console.log('  ⏭️  Skipped (requires auth)');
      continue;
    }
    
    // Warmup runs
    console.log(`  🔥 Running ${args.warmupRuns} warmup iterations...`);
    for (let i = 0; i < args.warmupRuns; i++) {
      try {
        await flow.run(page);
      } catch (e) {
        console.log(`  ⚠️ Warmup ${i + 1} failed: ${e.message}`);
      }
    }
    
    // Actual profiled run
    console.log('  📈 Capturing trace...');
    const tracePath = await startTracing(page, flowId);
    
    const startTime = performance.now();
    try {
      await flow.run(page);
    } catch (e) {
      console.log(`  ⚠️ Flow execution error: ${e.message}`);
    }
    const duration = performance.now() - startTime;
    
    await stopTracing(page);
    console.log(`  ✅ Trace saved: ${path.basename(tracePath)}`);
    results.artifacts.traces.push(tracePath);
    
    // Capture CPU profile
    console.log('  📊 Capturing CPU profile...');
    try {
      await flow.run(page);
      const cpuPath = await captureCPUProfile(client, flowId, 2000);
      console.log(`  ✅ CPU profile saved: ${path.basename(cpuPath)}`);
      results.artifacts.cpuProfiles.push(cpuPath);
    } catch (e) {
      console.log(`  ⚠️ CPU profile capture failed: ${e.message}`);
    }
    
    results.flows[flowId] = {
      name: flow.name,
      duration: Math.round(duration),
      trace: tracePath,
    };
  }
  
  // Capture heap snapshot for the heaviest page (dashboard)
  console.log('\n📦 Capturing heap snapshot (dashboard)...');
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await waitForNetworkIdle(page);
    const heapPath = await captureHeapSnapshot(client, 'dashboard');
    console.log(`  ✅ Heap snapshot saved: ${path.basename(heapPath)}`);
    results.artifacts.heapSnapshots.push(heapPath);
  } catch (e) {
    console.log(`  ⚠️ Heap snapshot failed: ${e.message}`);
  }
  
  await browser.close();
  
  // Run Lighthouse audits
  console.log('\n🔦 Running Lighthouse audits...');
  console.log('-'.repeat(40));
  
  try {
    // Mobile audit - home page
    const lhMobilePath = path.join(ARTIFACTS_DIR, 'lighthouse', 'lh-mobile.json');
    await runLighthouse(BASE_URL, lhMobilePath, true);
    results.artifacts.lighthouse.push(lhMobilePath);
    
    // Desktop audit - home page
    const lhDesktopPath = path.join(ARTIFACTS_DIR, 'lighthouse', 'lh-desktop.json');
    await runLighthouse(BASE_URL, lhDesktopPath, false);
    results.artifacts.lighthouse.push(lhDesktopPath);
    
    // Dashboard audit (authenticated page - may show login)
    const lhDashboardPath = path.join(ARTIFACTS_DIR, 'lighthouse', 'lh-dashboard.json');
    await runLighthouse(`${BASE_URL}/dashboard`, lhDashboardPath, true);
    results.artifacts.lighthouse.push(lhDashboardPath);
  } catch (e) {
    console.log(`  ⚠️ Lighthouse audit failed: ${e.message}`);
    console.log('  💡 You may need to install lighthouse: npm install -g lighthouse');
  }
  
  // Save results summary
  const summaryPath = path.join(ROOT_DIR, 'performance-report', 'profiling-results.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Profiling complete!`);
  console.log(`📄 Results summary: ${summaryPath}`);
  console.log(`📁 Artifacts directory: ${ARTIFACTS_DIR}\n`);
  
  return results;
}

main().catch(console.error);

