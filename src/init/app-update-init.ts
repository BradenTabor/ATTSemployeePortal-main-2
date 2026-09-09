/**
 * App update pipeline bootstrap.
 *
 * Registers the service worker and starts the version poll as early as
 * possible (before React mounts) so a waiting update can be applied during the
 * launch window, before the user starts typing. Same side-effect-module pattern
 * as perf-init / offline-init.
 */

import { startAppUpdates } from '../lib/appUpdate';

startAppUpdates();
