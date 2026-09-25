export interface AppUpdateState {
  available: boolean;
  updating: boolean;
  error: string | null;
}

/** One owner for worker installation, user consent, activation and reload. */
export function createAppUpdateManager(
  workers: ServiceWorkerContainer,
  notify: (state: AppUpdateState) => void,
  reload: () => void,
) {
  let registration: ServiceWorkerRegistration | undefined;
  let state: AppUpdateState = { available: false, updating: false, error: null };
  let disposed = false;
  let checking = false;
  let starting = false;
  let registrationRequest: { url: string; options: RegistrationOptions } | undefined;
  let reloaded = false;
  let controller = workers.controller;
  let changedController = false;
  let activationTimer: ReturnType<typeof setTimeout> | undefined;
  const watched = new Map<ServiceWorker, () => void>();

  function publish(next: Partial<AppUpdateState>) {
    state = { ...state, ...next };
    if (!disposed) notify(state);
  }
  function reloadOnce() {
    if (disposed || reloaded) return;
    reloaded = true;
    clearTimeout(activationTimer);
    reload();
  }
  function onControllerChange() {
    const next = workers.controller;
    if (!next || next === controller) return;
    // First install must never interrupt the initial app launch.
    if (controller) {
      changedController = true;
      if (state.updating) reloadOnce();
      else publish({ available: true }); // Another tab activated an update.
    }
    controller = next;
  }
  function inspect() {
    if (disposed || !registration) return;
    if (registration.waiting) publish({ available: true, error: null });
    const worker = registration.installing;
    if (!worker || watched.has(worker)) return;
    const onState = () => {
      if (worker.state === 'installed' && registration?.waiting) {
        publish({ available: true, error: null });
      }
      if (worker.state === 'redundant' && state.updating) {
        clearTimeout(activationTimer);
        publish({ updating: false, error: 'The update could not finish. Your current version is still available. Try again.' });
      }
    };
    watched.set(worker, onState);
    worker.addEventListener('statechange', onState);
    onState();
  }
  async function check() {
    if (disposed || !navigator.onLine) return;
    if (!registration) {
      if (registrationRequest) await start(registrationRequest.url, registrationRequest.options);
      return;
    }
    if (checking || registration.installing) return;
    checking = true;
    try {
      await registration.update();
      inspect();
    } catch {
      // A background network failure must not interrupt the working app.
    } finally {
      checking = false;
    }
  }
  async function start(url: string, options: RegistrationOptions = {}) {
    if (disposed || starting) return;
    starting = true;
    registrationRequest = { url, options };
    workers.addEventListener('controllerchange', onControllerChange);
    try {
      const result = await workers.register(url, { ...options, updateViaCache: 'none' });
      if (disposed) return;
      registration = result;
      registration.addEventListener('updatefound', inspect);
      inspect();
      void check();
    } catch {
      publish({ error: 'Updates are temporarily unavailable. You can keep using the app.' });
    } finally {
      starting = false;
    }
  }
  function apply() {
    if (disposed || state.updating || reloaded) return;
    if (changedController) { reloadOnce(); return; }
    const waiting = registration?.waiting;
    if (!waiting) {
      publish({ updating: false, error: 'The update is not ready yet. Please try again shortly.' });
      void check();
      return;
    }
    publish({ updating: true, error: null });
    // Sending SKIP_WAITING is not proof of activation. Wait for controllerchange.
    activationTimer = setTimeout(() => {
      publish({ updating: false, error: 'The update is taking longer than expected. Please try again. Your saved forms are safe.' });
    }, 20000);
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      clearTimeout(activationTimer);
      publish({ updating: false, error: 'Could not start the update. Please try again.' });
    }
  }
  function dispose() {
    disposed = true;
    clearTimeout(activationTimer);
    workers.removeEventListener('controllerchange', onControllerChange);
    registration?.removeEventListener('updatefound', inspect);
    watched.forEach((listener, worker) => worker.removeEventListener('statechange', listener));
  }
  return { start, check, apply, dispose };
}
