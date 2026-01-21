/**
 * App Version Management (AUTOMATED)
 * 
 * Version is automatically read from package.json at build time via Vite.
 * 
 * TO RELEASE A NEW VERSION:
 * 1. Run: npm version patch   (bug fixes, no onboarding shown)
 * 2. Run: npm version minor   (new features, shows onboarding)
 * 3. Run: npm version major   (breaking changes, shows onboarding)
 * 
 * The version is automatically injected by Vite's define config.
 * No manual editing of this file needed for version bumps!
 * 
 * If you want to update the "What's New" features shown in onboarding,
 * edit the WHATS_NEW_FEATURES array below.
 */

// Version is injected by Vite at build time from package.json
// Falls back to '0.0.0' only in edge cases (should never happen in production)
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

// Parse version for comparison
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return { major, minor, patch };
}

// Compare versions: returns -1 if a < b, 0 if equal, 1 if a > b
export function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);
  
  if (vA.major !== vB.major) return vA.major < vB.major ? -1 : 1;
  if (vA.minor !== vB.minor) return vA.minor < vB.minor ? -1 : 1;
  if (vA.patch !== vB.patch) return vA.patch < vB.patch ? -1 : 1;
  return 0;
}

// Storage keys
const STORAGE_KEYS = {
  LAST_SEEN_VERSION: 'atts_last_seen_version',
  ONBOARDING_COMPLETED_VERSION: 'atts_onboarding_completed_version',
  PROFILE_DISCOVERY_SHOWN: 'atts_profile_discovery_shown',
} as const;

/**
 * Get the last version the user has seen/acknowledged
 */
export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SEEN_VERSION);
  } catch {
    return null;
  }
}

/**
 * Set the last seen version (called after update completes)
 */
export function setLastSeenVersion(version: string = APP_VERSION): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, version);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the version for which onboarding was completed
 */
export function getOnboardingCompletedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED_VERSION);
  } catch {
    return null;
  }
}

/**
 * Mark onboarding as completed for current version
 */
export function setOnboardingCompleted(version: string = APP_VERSION): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED_VERSION, version);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if onboarding should be shown
 * Shows if:
 * - User has never seen onboarding, OR
 * - Current version has new MINOR or MAJOR features (not just patches)
 * 
 * Patch versions (1.1.1 -> 1.1.2) do NOT trigger onboarding
 * Minor versions (1.1.0 -> 1.2.0) DO trigger onboarding
 * Major versions (1.0.0 -> 2.0.0) DO trigger onboarding
 */
export function shouldShowOnboarding(): boolean {
  const completedVersion = getOnboardingCompletedVersion();
  
  // Never seen onboarding - show it
  if (!completedVersion) {
    return true;
  }
  
  const current = parseVersion(APP_VERSION);
  const completed = parseVersion(completedVersion);
  
  // Show if MAJOR or MINOR version increased (new features)
  // Don't show for patch-only updates (bug fixes)
  return current.major > completed.major || 
         (current.major === completed.major && current.minor > completed.minor);
}

/**
 * Check if profile discovery toast has been shown
 */
export function hasProfileDiscoveryBeenShown(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.PROFILE_DISCOVERY_SHOWN) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark profile discovery as shown
 */
export function setProfileDiscoveryShown(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE_DISCOVERY_SHOWN, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * What's New features for the current version
 * 
 * UPDATE THIS when releasing a new MINOR or MAJOR version!
 * These are the features shown in the onboarding carousel.
 */
export interface WhatsNewSubFeature {
  icon: string;
  title: string;
  description: string;
}

export interface WhatsNewFeature {
  id: string;
  icon: string; // Emoji for the icon
  title: string;
  description: string;
  highlight?: string; // Badge text (e.g., 'NEW', 'AI', 'BETA')
  linkTo?: string; // Navigation link when "Get Started" is clicked
  // Detailed breakdown of sub-features
  subFeatures?: WhatsNewSubFeature[];
  // Screenshot placeholder (base64 or path)
  screenshotPlaceholder?: 'profile' | 'settings' | 'smart-defaults' | 'notifications' | 'rewards' | 'quick-access';
  // Optional accent color for the feature (used for highlights)
  accentColor?: 'emerald' | 'amber' | 'purple' | 'blue' | 'pink';
}

export const WHATS_NEW_FEATURES: WhatsNewFeature[] = [
  {
    id: 'profile-page',
    icon: '👤',
    title: 'Your Profile Hub',
    description: 'A dedicated space to manage your employee information, certifications, and personalize your experience.',
    highlight: 'NEW',
    linkTo: '/profile',
    screenshotPlaceholder: 'profile',
    accentColor: 'emerald',
    subFeatures: [
      {
        icon: '📸',
        title: 'Custom Avatar',
        description: 'Upload a profile photo or choose from avatars. Your photo appears in the app header and forms.',
      },
      {
        icon: '🪪',
        title: 'License Tracking',
        description: 'View your driver\'s license details and class. Get alerts when expiration dates approach.',
      },
      {
        icon: '⚠️',
        title: 'Expiration Alerts',
        description: 'Visual badges show when certifications are expiring (30 days) or expired. Never miss a renewal.',
      },
      {
        icon: '🔔',
        title: 'Notification Control',
        description: 'Enable or disable push notifications directly from your profile with one tap.',
      },
    ],
  },
  {
    id: 'settings-page',
    icon: '⚙️',
    title: 'Settings & Saved Data',
    description: 'Save your frequently used information to dramatically speed up form completion.',
    highlight: 'NEW',
    linkTo: '/settings',
    screenshotPlaceholder: 'settings',
    accentColor: 'blue',
    subFeatures: [
      {
        icon: '👥',
        title: 'Contact Templates',
        description: 'Save emergency contact sets (OC, DOC, GF, Safety). Set a default that auto-fills in new JSA forms.',
      },
      {
        icon: '📍',
        title: 'Saved Locations',
        description: 'Store work sites with addresses, hospitals, clinics, and circuit numbers for instant form population.',
      },
      {
        icon: '✍️',
        title: 'Digital Signature',
        description: 'Draw and save your signature once. It appears automatically in the JSA review step.',
      },
      {
        icon: '🎛️',
        title: 'Form Preferences',
        description: 'Toggle auto-detect location, weather lookup, smart suggestions panel, and celebration animations.',
      },
    ],
  },
  {
    id: 'smart-defaults',
    icon: '✨',
    title: 'Smart Form Defaults',
    description: 'AI analyzes your submission history to suggest the most likely values for form fields.',
    highlight: 'AI',
    screenshotPlaceholder: 'smart-defaults',
    accentColor: 'purple',
    subFeatures: [
      {
        icon: '🧠',
        title: 'AI-Powered Analysis',
        description: 'Machine learning identifies patterns in your past submissions to predict what you\'ll enter next.',
      },
      {
        icon: '⚡',
        title: 'One-Tap Apply',
        description: 'Accept individual suggestions or apply all at once. Your data stays private—suggestions are local.',
      },
      {
        icon: '🚛',
        title: 'Vehicle Memory',
        description: 'Truck numbers, chipper numbers, trailer numbers—automatically suggested based on your history.',
      },
      {
        icon: '🔒',
        title: 'Privacy First',
        description: 'Contact information is never sent to AI. Only non-sensitive fields get smart suggestions.',
      },
    ],
  },
  {
    id: 'safety-rewards',
    icon: '🏆',
    title: 'Safety Rewards & XP',
    description: 'Earn XP and level up by engaging with safety content. Compete on leaderboards and unlock badges!',
    highlight: 'GAME',
    screenshotPlaceholder: 'rewards',
    accentColor: 'amber',
    subFeatures: [
      {
        icon: '⭐',
        title: 'Collect XP Points',
        description: 'Tap "Collect Points" on Safety AI announcements to earn XP. Each read = 1 point toward your next level.',
      },
      {
        icon: '🎖️',
        title: 'Level Up System',
        description: 'Progress through ranks: Newcomer → Getting Started → Safety Aware → Safety Pro → Safety Champion → Legend!',
      },
      {
        icon: '🔥',
        title: 'Streak Bonuses',
        description: 'Read announcements consistently to build streaks. Your weekly activity earns bonus recognition.',
      },
      {
        icon: '🏅',
        title: 'Leaderboards',
        description: 'See how you rank against coworkers. Top performers get featured with special badges and crowns.',
      },
    ],
  },
  {
    id: 'quick-access',
    icon: '📌',
    title: 'Quick Access Shortcuts',
    description: 'Pin your favorite tools for instant one-tap access. Personalize your dashboard your way.',
    highlight: 'NEW',
    screenshotPlaceholder: 'quick-access',
    accentColor: 'amber',
    subFeatures: [
      {
        icon: '👆',
        title: 'Long-Press to Pin',
        description: 'On mobile, long-press any item in All Tools. On desktop, right-click. Pin up to 4 shortcuts.',
      },
      {
        icon: '⚡',
        title: 'Instant Access',
        description: 'Your pinned shortcuts appear above All Tools for one-tap navigation to your most-used features.',
      },
      {
        icon: '🔄',
        title: 'Fully Customizable',
        description: 'Add or remove shortcuts anytime. Your preferences sync across sessions automatically.',
      },
      {
        icon: '💡',
        title: 'Smart Suggestions',
        description: 'New users see suggested pins based on role. Start with helpful defaults, then customize.',
      },
    ],
  },
  {
    id: 'push-notifications',
    icon: '🔔',
    title: 'Push Notifications',
    description: 'Real-time alerts keep you informed about safety announcements and important updates.',
    screenshotPlaceholder: 'notifications',
    accentColor: 'pink',
    subFeatures: [
      {
        icon: '⚡',
        title: 'Instant Alerts',
        description: 'Receive notifications the moment safety announcements are published—no need to check the app.',
      },
      {
        icon: '🛡️',
        title: 'Safety Updates',
        description: 'Daily safety briefings and hazard alerts delivered directly to your device at 7 AM.',
      },
      {
        icon: '📱',
        title: 'Works Offline',
        description: 'As a PWA, notifications work even when the app is closed. Just enable them in your profile.',
      },
      {
        icon: '🔕',
        title: 'Easy Control',
        description: 'Enable or disable notifications anytime from your Profile page. You\'re always in control.',
      },
    ],
  },
];

/**
 * Version release notes (for changelog/about page if needed)
 * This is auto-populated based on version, you can add notes here.
 */
export const VERSION_NOTES: Record<string, string> = {
  '1.1.0': 'Profile Hub, Settings, Smart Defaults, Safety Rewards & XP, Quick Access Shortcuts, Push Notifications',
  '1.0.0': 'Initial release',
};

/**
 * Debug helper - logs version info to console in development
 */
export function logVersionInfo(): void {
  if (import.meta.env.DEV) {
    console.log(`[ATTS Portal] Version: ${APP_VERSION}`);
    console.log(`[ATTS Portal] Build Time: ${BUILD_TIME}`);
    console.log(`[ATTS Portal] Last Seen: ${getLastSeenVersion()}`);
    console.log(`[ATTS Portal] Onboarding Completed: ${getOnboardingCompletedVersion()}`);
    console.log(`[ATTS Portal] Should Show Onboarding: ${shouldShowOnboarding()}`);
  }
}
