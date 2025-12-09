#!/usr/bin/env node
/**
 * Trace Analysis Script for ATTS Employee Portal
 * 
 * Parses Chrome DevTools traces and CPU profiles to identify performance hotspots.
 * 
 * Usage:
 *   node scripts/analyze-traces.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'performance-report', 'artifacts');
const REPORT_DIR = path.join(ROOT_DIR, 'performance-report');

// Thresholds
const LONG_TASK_THRESHOLD_MS = 50;
const LONG_GC_THRESHOLD_MS = 10;
const TOP_FUNCTIONS_COUNT = 20;
const TOP_EVENTS_COUNT = 10;

// Analysis results
const analysis = {
  timestamp: new Date().toISOString(),
  traces: {},
  cpuProfiles: {},
  lighthouse: {},
  hotspots: [],
  recommendations: [],
};

// Parse a Chrome trace file
function parseTrace(tracePath) {
  console.log(`  Parsing: ${path.basename(tracePath)}`);
  
  const content = fs.readFileSync(tracePath, 'utf8');
  const trace = JSON.parse(content);
  
  const events = trace.traceEvents || trace;
  
  const result = {
    file: path.basename(tracePath),
    longTasks: [],
    gcPauses: [],
    layoutThrashing: [],
    eventHandlers: {},
    topFunctions: [],
    forcedLayouts: [],
    styleRecalcs: [],
  };
  
  // Process events
  const taskStack = [];
  const functionTimes = new Map();
  const eventCounts = new Map();
  
  for (const event of events) {
    const { name, cat, ph, ts, dur, args } = event;
    
    // Long tasks
    if (name === 'RunTask' && dur && dur / 1000 > LONG_TASK_THRESHOLD_MS) {
      result.longTasks.push({
        duration: Math.round(dur / 1000),
        timestamp: ts,
        category: cat,
      });
    }
    
    // GC pauses
    if ((name?.includes('GC') || name?.includes('gc')) && dur) {
      const gcDuration = dur / 1000;
      if (gcDuration > LONG_GC_THRESHOLD_MS) {
        result.gcPauses.push({
          name,
          duration: Math.round(gcDuration),
          timestamp: ts,
        });
      }
    }
    
    // Forced synchronous layouts (Layout events with forced flag)
    if (name === 'Layout' && args?.beginData?.stackTrace) {
      result.forcedLayouts.push({
        duration: dur ? Math.round(dur / 1000) : 0,
        stackTrace: args.beginData.stackTrace.slice(0, 3),
      });
    }
    
    // Style recalculations
    if (name === 'UpdateLayoutTree' || name === 'RecalculateStyles') {
      if (dur && dur / 1000 > 5) {
        result.styleRecalcs.push({
          name,
          duration: Math.round(dur / 1000),
          elementCount: args?.elementCount || 0,
        });
      }
    }
    
    // Function executions (JS profiler)
    if (name === 'FunctionCall' || name === 'EvaluateScript') {
      const funcName = args?.data?.functionName || name;
      const current = functionTimes.get(funcName) || { total: 0, count: 0 };
      current.total += (dur || 0) / 1000;
      current.count += 1;
      functionTimes.set(funcName, current);
    }
    
    // Event handler tracking
    if (name === 'EventDispatch') {
      const eventType = args?.data?.type || 'unknown';
      const current = eventCounts.get(eventType) || { count: 0, totalDuration: 0 };
      current.count += 1;
      current.totalDuration += (dur || 0) / 1000;
      eventCounts.set(eventType, current);
    }
    
    // Layout thrashing detection (rapid Layout-Recalc cycles)
    if (name === 'Layout' || name === 'RecalculateStyles') {
      const prev = result.layoutThrashing[result.layoutThrashing.length - 1];
      if (prev && ts - prev.timestamp < 16000) { // Within 16ms
        prev.count += 1;
      } else {
        result.layoutThrashing.push({ timestamp: ts, count: 1, type: name });
      }
    }
  }
  
  // Sort and extract top functions
  result.topFunctions = Array.from(functionTimes.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_FUNCTIONS_COUNT);
  
  // Extract event handler stats
  result.eventHandlers = Array.from(eventCounts.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, TOP_EVENTS_COUNT);
  
  // Filter layout thrashing to significant occurrences
  result.layoutThrashing = result.layoutThrashing.filter(l => l.count > 3);
  
  // Sort long tasks by duration
  result.longTasks.sort((a, b) => b.duration - a.duration);
  
  return result;
}

// Parse CPU profile
function parseCPUProfile(profilePath) {
  console.log(`  Parsing: ${path.basename(profilePath)}`);
  
  const content = fs.readFileSync(profilePath, 'utf8');
  const profile = JSON.parse(content);
  
  const nodes = profile.nodes || [];
  const samples = profile.samples || [];
  const timeDeltas = profile.timeDeltas || [];
  
  // Build node map
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  
  // Calculate time per node
  const nodeTimes = new Map();
  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i];
    const delta = timeDeltas[i] || 0;
    const current = nodeTimes.get(nodeId) || 0;
    nodeTimes.set(nodeId, current + delta);
  }
  
  // Build function stats
  const functions = [];
  for (const [nodeId, selfTime] of nodeTimes.entries()) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    
    const callFrame = node.callFrame || {};
    const functionName = callFrame.functionName || '(anonymous)';
    const scriptUrl = callFrame.url || '';
    const lineNumber = callFrame.lineNumber || 0;
    
    // Skip system/browser internals
    if (scriptUrl.includes('chrome-extension') || 
        scriptUrl.includes('devtools') ||
        scriptUrl === '' && functionName === '(root)' ||
        functionName === '(idle)' ||
        functionName === '(program)') {
      continue;
    }
    
    functions.push({
      functionName,
      scriptUrl: scriptUrl.split('/').pop() || scriptUrl,
      lineNumber,
      selfTime: Math.round(selfTime / 1000), // Convert to ms
    });
  }
  
  // Sort by self time
  functions.sort((a, b) => b.selfTime - a.selfTime);
  
  return {
    file: path.basename(profilePath),
    totalTime: Math.round(timeDeltas.reduce((a, b) => a + b, 0) / 1000),
    topFunctions: functions.slice(0, TOP_FUNCTIONS_COUNT),
  };
}

// Parse Lighthouse report
function parseLighthouse(lhPath) {
  console.log(`  Parsing: ${path.basename(lhPath)}`);
  
  const content = fs.readFileSync(lhPath, 'utf8');
  const report = JSON.parse(content);
  
  const categories = report.categories || {};
  const audits = report.audits || {};
  
  const result = {
    file: path.basename(lhPath),
    formFactor: report.configSettings?.formFactor || 'unknown',
    scores: {},
    metrics: {},
    opportunities: [],
    diagnostics: [],
  };
  
  // Extract category scores
  for (const [key, cat] of Object.entries(categories)) {
    result.scores[key] = Math.round((cat.score || 0) * 100);
  }
  
  // Extract key metrics
  const metricKeys = [
    'first-contentful-paint',
    'largest-contentful-paint', 
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
  ];
  
  for (const key of metricKeys) {
    const audit = audits[key];
    if (audit) {
      result.metrics[key] = {
        score: Math.round((audit.score || 0) * 100),
        value: audit.numericValue || 0,
        displayValue: audit.displayValue || '',
      };
    }
  }
  
  // Extract opportunities
  const opportunityKeys = [
    'render-blocking-resources',
    'unused-javascript',
    'unused-css-rules',
    'modern-image-formats',
    'offscreen-images',
    'unminified-javascript',
    'unminified-css',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'dom-size',
    'mainthread-work-breakdown',
    'bootup-time',
  ];
  
  for (const key of opportunityKeys) {
    const audit = audits[key];
    if (audit && audit.score !== null && audit.score < 1) {
      result.opportunities.push({
        id: key,
        title: audit.title,
        score: Math.round((audit.score || 0) * 100),
        savings: audit.numericValue || 0,
        displayValue: audit.displayValue || '',
      });
    }
  }
  
  // Sort opportunities by potential savings
  result.opportunities.sort((a, b) => b.savings - a.savings);
  
  return result;
}

// Identify hotspots from all analyses
function identifyHotspots(analysis) {
  const hotspots = [];
  
  // From traces: long tasks
  for (const [traceId, trace] of Object.entries(analysis.traces)) {
    for (const task of trace.longTasks.slice(0, 5)) {
      hotspots.push({
        type: 'long-task',
        source: traceId,
        duration: task.duration,
        severity: task.duration > 100 ? 'high' : task.duration > 50 ? 'medium' : 'low',
        description: `Long main-thread task: ${task.duration}ms`,
        category: task.category,
      });
    }
    
    // GC pauses
    for (const gc of trace.gcPauses.slice(0, 3)) {
      hotspots.push({
        type: 'gc-pause',
        source: traceId,
        duration: gc.duration,
        severity: gc.duration > 50 ? 'high' : 'medium',
        description: `Long GC pause (${gc.name}): ${gc.duration}ms`,
      });
    }
    
    // Layout thrashing
    for (const thrash of trace.layoutThrashing.slice(0, 3)) {
      if (thrash.count > 5) {
        hotspots.push({
          type: 'layout-thrashing',
          source: traceId,
          count: thrash.count,
          severity: thrash.count > 10 ? 'high' : 'medium',
          description: `Layout thrashing detected: ${thrash.count} rapid layout operations`,
        });
      }
    }
    
    // Forced layouts
    for (const layout of trace.forcedLayouts.slice(0, 3)) {
      if (layout.duration > 10) {
        hotspots.push({
          type: 'forced-layout',
          source: traceId,
          duration: layout.duration,
          severity: 'medium',
          description: `Forced synchronous layout: ${layout.duration}ms`,
          stackTrace: layout.stackTrace,
        });
      }
    }
    
    // Heavy event handlers
    for (const handler of trace.eventHandlers.slice(0, 3)) {
      if (handler.totalDuration > 100) {
        hotspots.push({
          type: 'event-handler',
          source: traceId,
          eventType: handler.type,
          count: handler.count,
          duration: Math.round(handler.totalDuration),
          severity: handler.totalDuration > 500 ? 'high' : 'medium',
          description: `Heavy ${handler.type} handlers: ${handler.count} calls, ${Math.round(handler.totalDuration)}ms total`,
        });
      }
    }
  }
  
  // From CPU profiles: hot functions
  for (const [profileId, profile] of Object.entries(analysis.cpuProfiles)) {
    for (const func of profile.topFunctions.slice(0, 5)) {
      if (func.selfTime > 20) {
        hotspots.push({
          type: 'hot-function',
          source: profileId,
          functionName: func.functionName,
          scriptUrl: func.scriptUrl,
          lineNumber: func.lineNumber,
          selfTime: func.selfTime,
          severity: func.selfTime > 100 ? 'high' : func.selfTime > 50 ? 'medium' : 'low',
          description: `Hot function "${func.functionName}": ${func.selfTime}ms self-time`,
        });
      }
    }
  }
  
  // From Lighthouse: opportunities
  for (const [lhId, lh] of Object.entries(analysis.lighthouse)) {
    for (const opp of lh.opportunities.slice(0, 5)) {
      hotspots.push({
        type: 'lighthouse-opportunity',
        source: lhId,
        auditId: opp.id,
        title: opp.title,
        score: opp.score,
        savings: opp.savings,
        severity: opp.score < 50 ? 'high' : opp.score < 75 ? 'medium' : 'low',
        description: `${opp.title}: ${opp.displayValue}`,
      });
    }
    
    // Poor metrics
    for (const [metricId, metric] of Object.entries(lh.metrics)) {
      if (metric.score < 50) {
        hotspots.push({
          type: 'lighthouse-metric',
          source: lhId,
          metricId,
          score: metric.score,
          value: metric.value,
          severity: metric.score < 25 ? 'high' : 'medium',
          description: `Poor ${metricId}: ${metric.displayValue} (score: ${metric.score})`,
        });
      }
    }
  }
  
  // Dedupe and rank hotspots
  const ranked = hotspots
    .sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return (b.duration || b.savings || 0) - (a.duration || a.savings || 0);
    })
    .slice(0, 30);
  
  return ranked;
}

// Generate fix recommendations based on hotspots
function generateRecommendations(hotspots) {
  const recommendations = [];
  const seenTypes = new Set();
  
  for (const hotspot of hotspots) {
    // Only add one recommendation per type
    const key = `${hotspot.type}-${hotspot.severity}`;
    if (seenTypes.has(key)) continue;
    seenTypes.add(key);
    
    let rec = null;
    
    switch (hotspot.type) {
      case 'long-task':
        rec = {
          hotspot,
          priority: hotspot.severity === 'high' ? 1 : 2,
          title: 'Break up long main-thread tasks',
          cause: 'Long-running JavaScript blocks the main thread, causing jank',
          suggestion: `
Use requestIdleCallback or setTimeout to break up work:

// Before
function processLargeArray(items) {
  items.forEach(item => expensiveOperation(item));
}

// After
async function processLargeArray(items) {
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    chunk.forEach(item => expensiveOperation(item));
    await new Promise(r => setTimeout(r, 0)); // Yield to main thread
  }
}`,
          impact: '15-30% reduction in main-thread blocking',
          risk: 'Low',
          validation: 'Re-run profiling to verify task durations are < 50ms',
        };
        break;
        
      case 'layout-thrashing':
        rec = {
          hotspot,
          priority: 1,
          title: 'Fix layout thrashing',
          cause: 'Alternating reads and writes to DOM causes forced synchronous layouts',
          suggestion: `
Batch DOM reads and writes:

// Before (causes thrashing)
elements.forEach(el => {
  const height = el.offsetHeight; // Read
  el.style.height = height + 10 + 'px'; // Write
});

// After (batched)
const heights = elements.map(el => el.offsetHeight); // All reads
elements.forEach((el, i) => {
  el.style.height = heights[i] + 10 + 'px'; // All writes
});

// Or use requestAnimationFrame
function batchUpdate() {
  requestAnimationFrame(() => {
    // All reads here
    const measurements = elements.map(el => el.offsetHeight);
    
    requestAnimationFrame(() => {
      // All writes here
      elements.forEach((el, i) => {
        el.style.height = measurements[i] + 10 + 'px';
      });
    });
  });
}`,
          impact: '20-40% reduction in layout time',
          risk: 'Low',
          validation: 'Check trace for "Forced reflow" warnings',
        };
        break;
        
      case 'event-handler':
        if (hotspot.eventType === 'scroll' || hotspot.eventType === 'resize') {
          rec = {
            hotspot,
            priority: 1,
            title: `Throttle ${hotspot.eventType} event handlers`,
            cause: `Unthrottled ${hotspot.eventType} handlers fire too frequently`,
            suggestion: `
Add throttling/debouncing:

// Using lodash throttle
import { throttle } from 'lodash-es';

const handleScroll = throttle(() => {
  // Your scroll logic
}, 16); // ~60fps

window.addEventListener('scroll', handleScroll, { passive: true });

// Or use requestAnimationFrame
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      // Your scroll logic
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// Also mark as passive for better performance
element.addEventListener('scroll', handler, { passive: true });`,
            impact: '30-50% reduction in scroll jank',
            risk: 'Low',
            validation: 'Check that scroll events < 10 per second in trace',
          };
        }
        break;
        
      case 'gc-pause':
        rec = {
          hotspot,
          priority: 2,
          title: 'Reduce garbage collection pressure',
          cause: 'Frequent object allocations trigger GC pauses',
          suggestion: `
Reduce allocations:

// Before (creates new objects in render loop)
function Component() {
  return <div style={{ color: 'red' }} />; // New object every render
}

// After (stable reference)
const style = { color: 'red' };
function Component() {
  return <div style={style} />;
}

// Or use useMemo for computed values
function Component({ items }) {
  const processed = useMemo(() => 
    items.map(i => ({ ...i, computed: expensive(i) })),
    [items]
  );
  return <List items={processed} />;
}`,
          impact: '10-20% reduction in GC time',
          risk: 'Low',
          validation: 'Heap snapshot should show stable memory',
        };
        break;
        
      case 'hot-function':
        rec = {
          hotspot,
          priority: hotspot.severity === 'high' ? 1 : 2,
          title: `Optimize hot function: ${hotspot.functionName}`,
          cause: `Function "${hotspot.functionName}" in ${hotspot.scriptUrl} taking ${hotspot.selfTime}ms`,
          suggestion: `
Check ${hotspot.scriptUrl}:${hotspot.lineNumber} for:
1. Expensive computations that can be memoized
2. Unnecessary re-renders (use React.memo, useMemo, useCallback)
3. Large array operations that can be optimized
4. Synchronous operations that can be deferred

Example optimization:
// Before
function Component({ items }) {
  const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
  return <List items={sorted} />;
}

// After
function Component({ items }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  return <List items={sorted} />;
}`,
          impact: `Potential ${Math.round(hotspot.selfTime * 0.5)}ms reduction`,
          risk: 'Medium - requires code review',
          validation: `Re-profile and check "${hotspot.functionName}" time`,
        };
        break;
        
      case 'lighthouse-opportunity':
        if (hotspot.auditId === 'unused-javascript') {
          rec = {
            hotspot,
            priority: 1,
            title: 'Remove unused JavaScript',
            cause: 'Large JS bundles with unused code slow initial load',
            suggestion: `
1. Use dynamic imports for route-based code splitting:
   const Dashboard = lazy(() => import('./pages/Dashboard'));

2. Tree-shake unused exports:
   // Import only what you need
   import { format } from 'date-fns'; // Not: import * as dateFns

3. Analyze bundle with:
   npx vite-bundle-visualizer

4. Consider removing unused dependencies`,
            impact: `${hotspot.displayValue || 'Significant'} reduction in JS payload`,
            risk: 'Medium',
            validation: 'Lighthouse unused-javascript score should improve',
          };
        } else if (hotspot.auditId === 'mainthread-work-breakdown') {
          rec = {
            hotspot,
            priority: 1,
            title: 'Reduce main thread work',
            cause: 'Too much JavaScript execution blocking the main thread',
            suggestion: `
1. Defer non-critical JavaScript:
   <script defer src="..."></script>

2. Use web workers for heavy computation:
   const worker = new Worker('./heavy-computation.js');

3. Lazy load components below the fold:
   const HeavyComponent = lazy(() => import('./HeavyComponent'));

4. Optimize React renders with memo/useMemo`,
            impact: '20-40% improvement in TTI',
            risk: 'Medium',
            validation: 'Check TBT and TTI metrics in Lighthouse',
          };
        } else if (hotspot.auditId === 'dom-size') {
          rec = {
            hotspot,
            priority: 2,
            title: 'Reduce DOM size',
            cause: 'Large DOM trees slow down CSS matching and layout',
            suggestion: `
1. Virtualize long lists:
   import { FixedSizeList } from 'react-window';

2. Lazy render off-screen content:
   Use IntersectionObserver to defer rendering

3. Remove unnecessary wrapper elements:
   Use React.Fragment instead of divs

4. Paginate large data sets`,
            impact: '10-30% improvement in layout performance',
            risk: 'Low',
            validation: 'DOM node count should decrease',
          };
        }
        break;
        
      case 'lighthouse-metric':
        if (hotspot.metricId === 'largest-contentful-paint') {
          rec = {
            hotspot,
            priority: 1,
            title: 'Improve Largest Contentful Paint (LCP)',
            cause: 'Main content takes too long to render',
            suggestion: `
1. Preload critical assets:
   <link rel="preload" href="hero-image.jpg" as="image">

2. Optimize images:
   - Use modern formats (WebP, AVIF)
   - Add explicit width/height
   - Use responsive images

3. Inline critical CSS
4. Reduce server response time
5. Remove render-blocking resources`,
            impact: 'Major improvement in perceived load time',
            risk: 'Low',
            validation: 'LCP should be < 2.5s',
          };
        } else if (hotspot.metricId === 'total-blocking-time') {
          rec = {
            hotspot,
            priority: 1,
            title: 'Reduce Total Blocking Time (TBT)',
            cause: 'Long tasks blocking the main thread after FCP',
            suggestion: `
1. Break up long tasks (see long-task recommendations)
2. Defer non-critical JavaScript
3. Reduce JavaScript execution time
4. Optimize third-party scripts`,
            impact: 'Improved interactivity',
            risk: 'Medium',
            validation: 'TBT should be < 200ms',
          };
        } else if (hotspot.metricId === 'cumulative-layout-shift') {
          rec = {
            hotspot,
            priority: 1,
            title: 'Fix Cumulative Layout Shift (CLS)',
            cause: 'Content shifting after initial render',
            suggestion: `
1. Set explicit dimensions on images/videos:
   <img width="400" height="300" src="..." />

2. Reserve space for dynamic content:
   .container { min-height: 200px; }

3. Avoid inserting content above existing content
4. Use transform for animations instead of position`,
            impact: 'Better visual stability',
            risk: 'Low',
            validation: 'CLS should be < 0.1',
          };
        }
        break;
    }
    
    if (rec) {
      recommendations.push(rec);
    }
  }
  
  // Sort by priority
  recommendations.sort((a, b) => a.priority - b.priority);
  
  return recommendations.slice(0, 10);
}

// Main execution
async function main() {
  console.log('\n📊 ATTS Employee Portal - Trace Analysis\n');
  console.log('='.repeat(60));
  
  // Check for artifacts
  const tracesDir = path.join(ARTIFACTS_DIR, 'traces');
  const cpuDir = path.join(ARTIFACTS_DIR, 'cpu-profiles');
  const lhDir = path.join(ARTIFACTS_DIR, 'lighthouse');
  
  // Parse traces
  console.log('\n📈 Analyzing Chrome traces...');
  if (fs.existsSync(tracesDir)) {
    const traceFiles = fs.readdirSync(tracesDir).filter(f => f.endsWith('.trace.json'));
    for (const file of traceFiles) {
      try {
        const name = file.replace('.trace.json', '');
        analysis.traces[name] = parseTrace(path.join(tracesDir, file));
      } catch (e) {
        console.log(`  ⚠️ Failed to parse ${file}: ${e.message}`);
      }
    }
    console.log(`  ✅ Analyzed ${Object.keys(analysis.traces).length} traces`);
  } else {
    console.log('  ⚠️ No traces directory found');
  }
  
  // Parse CPU profiles
  console.log('\n📊 Analyzing CPU profiles...');
  if (fs.existsSync(cpuDir)) {
    const cpuFiles = fs.readdirSync(cpuDir).filter(f => f.endsWith('.cpuprofile'));
    for (const file of cpuFiles) {
      try {
        const name = file.replace('.cpuprofile', '');
        analysis.cpuProfiles[name] = parseCPUProfile(path.join(cpuDir, file));
      } catch (e) {
        console.log(`  ⚠️ Failed to parse ${file}: ${e.message}`);
      }
    }
    console.log(`  ✅ Analyzed ${Object.keys(analysis.cpuProfiles).length} CPU profiles`);
  } else {
    console.log('  ⚠️ No CPU profiles directory found');
  }
  
  // Parse Lighthouse reports
  console.log('\n🔦 Analyzing Lighthouse reports...');
  if (fs.existsSync(lhDir)) {
    const lhFiles = fs.readdirSync(lhDir).filter(f => f.endsWith('.json'));
    for (const file of lhFiles) {
      try {
        const name = file.replace('.json', '');
        analysis.lighthouse[name] = parseLighthouse(path.join(lhDir, file));
      } catch (e) {
        console.log(`  ⚠️ Failed to parse ${file}: ${e.message}`);
      }
    }
    console.log(`  ✅ Analyzed ${Object.keys(analysis.lighthouse).length} Lighthouse reports`);
  } else {
    console.log('  ⚠️ No Lighthouse directory found');
  }
  
  // Identify hotspots
  console.log('\n🔥 Identifying hotspots...');
  analysis.hotspots = identifyHotspots(analysis);
  console.log(`  ✅ Found ${analysis.hotspots.length} hotspots`);
  
  // Generate recommendations
  console.log('\n💡 Generating recommendations...');
  analysis.recommendations = generateRecommendations(analysis.hotspots);
  console.log(`  ✅ Generated ${analysis.recommendations.length} recommendations`);
  
  // Save analysis results
  const analysisPath = path.join(REPORT_DIR, 'analysis-results.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`\n📄 Analysis saved to: ${analysisPath}`);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 HOTSPOT SUMMARY');
  console.log('='.repeat(60));
  
  const highSeverity = analysis.hotspots.filter(h => h.severity === 'high');
  const mediumSeverity = analysis.hotspots.filter(h => h.severity === 'medium');
  
  console.log(`\n🔴 High severity: ${highSeverity.length}`);
  console.log(`🟡 Medium severity: ${mediumSeverity.length}`);
  
  console.log('\n📌 Top 10 Hotspots:');
  for (let i = 0; i < Math.min(10, analysis.hotspots.length); i++) {
    const h = analysis.hotspots[i];
    const icon = h.severity === 'high' ? '🔴' : h.severity === 'medium' ? '🟡' : '🟢';
    console.log(`  ${i + 1}. ${icon} [${h.type}] ${h.description}`);
  }
  
  console.log('\n💡 Top Recommendations:');
  for (let i = 0; i < Math.min(5, analysis.recommendations.length); i++) {
    const r = analysis.recommendations[i];
    console.log(`  ${i + 1}. ${r.title}`);
    console.log(`     Impact: ${r.impact} | Risk: ${r.risk}`);
  }
  
  console.log('\n✅ Analysis complete!\n');
  
  return analysis;
}

main().catch(console.error);

