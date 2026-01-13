#!/usr/bin/env node

/**
 * iOS PWA Configuration Verification Script
 * 
 * Verifies that all required iOS Safari PWA and push notification
 * configurations are in place before deployment.
 * 
 * Usage: node scripts/verify-ios-pwa.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🔍 Verifying iOS PWA Configuration...\n');

let errors = 0;
let warnings = 0;

// ============================================
// Check 1: iOS meta tags in index.html
// ============================================
console.log('📄 Checking index.html...');

const indexPath = path.join(projectRoot, 'index.html');
let indexContent = '';

try {
  indexContent = fs.readFileSync(indexPath, 'utf-8');
} catch (err) {
  console.error('❌ Cannot read index.html:', err.message);
  errors++;
}

if (indexContent) {
  const requiredMetaTags = [
    { tag: 'apple-mobile-web-app-capable', desc: 'iOS PWA capability' },
    { tag: 'apple-mobile-web-app-status-bar-style', desc: 'Status bar style' },
    { tag: 'apple-mobile-web-app-title', desc: 'App title' },
  ];

  requiredMetaTags.forEach(({ tag, desc }) => {
    if (indexContent.includes(tag)) {
      console.log(`   ✅ Found: ${tag}`);
    } else {
      console.error(`   ❌ Missing: ${tag} (${desc})`);
      errors++;
    }
  });

  // Check for apple-touch-icon link
  if (indexContent.includes('apple-touch-icon')) {
    console.log('   ✅ Found: apple-touch-icon link');
  } else {
    console.error('   ❌ Missing: apple-touch-icon link');
    errors++;
  }

  // Check for manifest link
  if (indexContent.includes('rel="manifest"')) {
    console.log('   ✅ Found: manifest link');
  } else {
    console.error('   ❌ Missing: manifest link');
    errors++;
  }
}

console.log('');

// ============================================
// Check 2: Required assets in public/
// ============================================
console.log('🖼️  Checking public assets...');

const requiredAssets = [
  { file: 'public/apple-touch-icon.png', desc: 'Apple touch icon (180x180)' },
  { file: 'public/badge-96.png', desc: 'Notification badge (96x96)' },
  { file: 'public/icon-192.png', desc: 'PWA icon (192x192)' },
  { file: 'public/icon-512.png', desc: 'PWA icon (512x512)' },
  { file: 'public/manifest.json', desc: 'Web app manifest' },
];

requiredAssets.forEach(({ file, desc }) => {
  const assetPath = path.join(projectRoot, file);
  if (fs.existsSync(assetPath)) {
    const stats = fs.statSync(assetPath);
    console.log(`   ✅ Found: ${file} (${Math.round(stats.size / 1024)}KB)`);
  } else {
    console.error(`   ❌ Missing: ${file} (${desc})`);
    errors++;
  }
});

console.log('');

// ============================================
// Check 3: Manifest configuration
// ============================================
console.log('📋 Checking manifest.json...');

const manifestPath = path.join(projectRoot, 'public/manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    // Check display mode
    if (manifest.display === 'standalone') {
      console.log('   ✅ Display mode: standalone');
    } else {
      console.error(`   ❌ Display mode is "${manifest.display}", should be "standalone"`);
      errors++;
    }

    // Check icons
    if (manifest.icons && manifest.icons.length > 0) {
      console.log(`   ✅ Icons defined: ${manifest.icons.length} icons`);
      
      // Check for maskable icon
      const hasMaskable = manifest.icons.some(icon => 
        icon.purpose?.includes('maskable')
      );
      if (hasMaskable) {
        console.log('   ✅ Maskable icon defined');
      } else {
        console.warn('   ⚠️  No maskable icon defined (iOS may not show icon correctly)');
        warnings++;
      }
    } else {
      console.error('   ❌ No icons defined in manifest');
      errors++;
    }

    // Check name
    if (manifest.name) {
      console.log(`   ✅ App name: "${manifest.name}"`);
    } else {
      console.error('   ❌ App name not defined');
      errors++;
    }

    // Check start_url
    if (manifest.start_url) {
      console.log(`   ✅ Start URL: "${manifest.start_url}"`);
    } else {
      console.warn('   ⚠️  start_url not defined (will default to current page)');
      warnings++;
    }

  } catch (err) {
    console.error('   ❌ Failed to parse manifest.json:', err.message);
    errors++;
  }
} else {
  console.error('   ❌ manifest.json not found');
  errors++;
}

console.log('');

// ============================================
// Check 4: Service worker iOS options
// ============================================
console.log('⚙️  Checking service worker (src/sw.ts)...');

const swPath = path.join(projectRoot, 'src/sw.ts');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf-8');
  
  // Check for silent: false (critical for iOS sound)
  if (swContent.includes('silent: false')) {
    console.log('   ✅ Found: silent: false (iOS sound enabled)');
  } else {
    console.warn('   ⚠️  Missing "silent: false" - iOS notifications may not play sound');
    warnings++;
  }

  // Check for vibration pattern
  if (swContent.includes('vibrate:')) {
    console.log('   ✅ Found: vibration pattern');
  } else {
    console.warn('   ⚠️  Missing vibration pattern');
    warnings++;
  }

  // Check for actions array
  if (swContent.includes('actions:')) {
    console.log('   ✅ Found: notification actions');
  } else {
    console.warn('   ⚠️  Missing notification actions (iOS can show action buttons)');
    warnings++;
  }

  // Check for renotify
  if (swContent.includes('renotify:')) {
    console.log('   ✅ Found: renotify option');
  } else {
    console.warn('   ⚠️  Missing renotify option');
    warnings++;
  }

  // Check for badge-96.png
  if (swContent.includes('badge-96.png')) {
    console.log('   ✅ Found: badge-96.png reference');
  } else if (swContent.includes('badge:')) {
    console.warn('   ⚠️  Badge defined but not using badge-96.png');
    warnings++;
  }

} else {
  console.error('   ❌ src/sw.ts not found');
  errors++;
}

console.log('');

// ============================================
// Check 5: iOS detection in hook
// ============================================
console.log('🎣 Checking usePushNotifications hook...');

const hookPath = path.join(projectRoot, 'src/hooks/usePushNotifications.ts');
if (fs.existsSync(hookPath)) {
  const hookContent = fs.readFileSync(hookPath, 'utf-8');
  
  // Check for iOS detection
  if (hookContent.includes('isIOS')) {
    console.log('   ✅ Found: iOS detection (isIOS)');
  } else {
    console.warn('   ⚠️  Missing iOS detection');
    warnings++;
  }

  // Check for installation detection
  if (hookContent.includes('isInstalled')) {
    console.log('   ✅ Found: installation detection (isInstalled)');
  } else {
    console.warn('   ⚠️  Missing installation detection');
    warnings++;
  }

  // Check for iOS version detection
  if (hookContent.includes('iOSVersion')) {
    console.log('   ✅ Found: iOS version detection');
  } else {
    console.warn('   ⚠️  Missing iOS version detection');
    warnings++;
  }

} else {
  console.error('   ❌ src/hooks/usePushNotifications.ts not found');
  errors++;
}

console.log('');

// ============================================
// Check 6: iOS Install Prompt component
// ============================================
console.log('📱 Checking IOSInstallPrompt component...');

const promptPath = path.join(projectRoot, 'src/components/pwa/IOSInstallPrompt.tsx');
if (fs.existsSync(promptPath)) {
  console.log('   ✅ Found: IOSInstallPrompt component');
  
  const promptContent = fs.readFileSync(promptPath, 'utf-8');
  
  if (promptContent.includes('Add to Home Screen')) {
    console.log('   ✅ Contains installation instructions');
  } else {
    console.warn('   ⚠️  May be missing installation instructions');
    warnings++;
  }
} else {
  console.error('   ❌ src/components/pwa/IOSInstallPrompt.tsx not found');
  errors++;
}

console.log('');

// ============================================
// Summary
// ============================================
console.log('='.repeat(50));
console.log('');

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! iOS PWA is properly configured.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run "npm run build" to create production build');
  console.log('2. Deploy to HTTPS URL');
  console.log('3. Test on real iPhone (iOS Simulator does NOT support push)');
  console.log('');
  process.exit(0);
} else {
  console.log(`Found ${errors} error(s) and ${warnings} warning(s)`);
  console.log('');
  
  if (errors > 0) {
    console.log('❌ Please fix errors before deploying to production.');
    console.log('');
    process.exit(1);
  } else {
    console.log('⚠️  Warnings are non-blocking but may affect iOS experience.');
    console.log('');
    process.exit(0);
  }
}



