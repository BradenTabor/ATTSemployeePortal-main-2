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
    id: 'certifications-training',
    icon: '🎓',
    title: 'Certifications & Training',
    description: 'Take certification tests and access training materials from Resources. Track your progress and get reminders before credentials expire.',
    highlight: 'NEW',
    linkTo: '/resources',
    screenshotPlaceholder: 'rewards',
    accentColor: 'emerald',
    subFeatures: [
      {
        icon: '📝',
        title: 'Certification Tests',
        description: 'Take written and practical evaluations for equipment and safety certifications. Your results are saved and visible in your profile.',
      },
      {
        icon: '📚',
        title: 'Training Materials',
        description: 'Browse safety and training documents in Resources. Quick access to procedures and reference guides.',
      },
      {
        icon: '⏰',
        title: 'Expiration Reminders',
        description: 'Get notified when certifications are nearing expiration so you can renew on time.',
      },
      {
        icon: '✅',
        title: 'Progress at a Glance',
        description: 'See which certifications you\'ve completed and which are available. Evaluators can conduct practicals from the app.',
      },
    ],
  },
  {
    id: 'tree-felling-jsa',
    icon: '🌲',
    title: 'Tree Felling JSA',
    description: 'Complete Job Safety Analyses for tree felling work with the dedicated form. Same familiar JSA workflow, built for this high-risk task.',
    highlight: 'NEW',
    linkTo: '/forms/jsa/tree-felling',
    screenshotPlaceholder: 'smart-defaults',
    accentColor: 'amber',
    subFeatures: [
      {
        icon: '📋',
        title: 'Dedicated Form',
        description: 'Tree felling–specific steps and hazards. Fill out once per job and submit from the app.',
      },
      {
        icon: '🔄',
        title: 'Same JSA Flow',
        description: 'Review step, signatures, and history work just like Daily JSA. View and search past tree felling JSAs in Forms History.',
      },
      {
        icon: '⚡',
        title: 'Quick Access',
        description: 'Open from Forms or pin Tree Felling JSA in Quick Access for one-tap access.',
      },
    ],
  },
  {
    id: 'request-time-off',
    icon: '🏖️',
    title: 'Request Time Off',
    description: 'Submit and track time-off requests from the app. Pick dates, add a reason, and see status in one place.',
    highlight: 'NEW',
    linkTo: '/dashboard/forms/request-time-off',
    screenshotPlaceholder: 'quick-access',
    accentColor: 'blue',
    subFeatures: [
      {
        icon: '📅',
        title: 'Choose Dates',
        description: 'Select start and end dates for your time off. The form guides you through required details.',
      },
      {
        icon: '📬',
        title: 'Submit & Track',
        description: 'Submit your request with one tap. Track pending and past requests in the same place.',
      },
      {
        icon: '🔗',
        title: 'Easy to Find',
        description: 'Available under Forms in the app. Admins manage and approve requests from the Admin RTO page.',
      },
    ],
  },
];

/**
 * Version release notes (for changelog/about page if needed)
 * This is auto-populated based on version, you can add notes here.
 */
export const VERSION_NOTES: Record<string, string> = {
  '1.1.0': 'Certifications & Training, Tree Felling JSA, Request Time Off',
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
