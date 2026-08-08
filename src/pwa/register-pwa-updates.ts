import { registerSW } from "virtual:pwa-register";
import { getSaveBeforeReload, shouldAutoApplyUpdate } from "./update-policy";
import { fetchRemoteVersion, isRemoteVersionNewer } from "./version-beacon";

const UPDATE_CHECK_DEBOUNCE_MS = 60_000;
const PERIODIC_CHECK_MS = 20 * 60_000;
const CONTROLLER_CHANGE_TIMEOUT_MS = 2_000;

type UpdateListener = () => void;

let swRegistration: ServiceWorkerRegistration | undefined;
let activateWaitingWorker: (() => void) | undefined;
let lastCheckAt = 0;
let updateReady = false;
let promptDismissed = false;
let reloading = false;
let periodicTimer: number | null = null;

const listeners = new Set<UpdateListener>();

const notifyListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeToUpdateAvailable = (listener: UpdateListener): (() => void) => {
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
};

export const isUpdateReady = (): boolean => updateReady;

export const isUpdatePromptVisible = (): boolean =>
  updateReady && !promptDismissed && shouldAutoApplyUpdate() === false;

export const dismissUpdatePrompt = (): void => {
  promptDismissed = true;
  notifyListeners();
};

const markUpdateReady = (): void => {
  if (updateReady) {
    if (shouldAutoApplyUpdate()) {
      void applyPwaUpdate();
    } else {
      notifyListeners();
    }
    return;
  }
  updateReady = true;
  notifyListeners();
  if (shouldAutoApplyUpdate()) {
    void applyPwaUpdate();
  }
};

const waitForControllerChange = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", finish, {
      once: true,
    });
    window.setTimeout(finish, CONTROLLER_CHANGE_TIMEOUT_MS);
  });
};

const activateServiceWorkerUpdate = async (
  registration?: ServiceWorkerRegistration,
): Promise<void> => {
  const reg =
    registration ?? swRegistration ?? (await navigator.serviceWorker.getRegistration());
  activateWaitingWorker?.();
  reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
  await waitForControllerChange();
};

export const applyPwaUpdate = async (): Promise<void> => {
  if (reloading || !updateReady) {
    return;
  }
  reloading = true;
  getSaveBeforeReload()?.();
  try {
    await activateServiceWorkerUpdate();
  } finally {
    window.location.reload();
  }
};

const watchRegistration = (registration: ServiceWorkerRegistration): void => {
  if (registration.waiting) {
    markUpdateReady();
  }
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) {
      return;
    }
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        markUpdateReady();
      }
    });
  });
};

const runUpdateCheck = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const now = Date.now();
  if (now - lastCheckAt < UPDATE_CHECK_DEBOUNCE_MS) {
    return;
  }
  lastCheckAt = now;
  promptDismissed = false;

  const registration =
    swRegistration ?? (await navigator.serviceWorker.getRegistration());
  if (!registration) {
    return;
  }

  try {
    await registration.update();
  } catch {
    /* offline or update check throttled */
  }

  if (registration.waiting) {
    markUpdateReady();
    return;
  }

  const remote = await fetchRemoteVersion();
  if (remote && isRemoteVersionNewer(remote.commit)) {
    try {
      await registration.update();
    } catch {
      /* ignore */
    }
    markUpdateReady();
  }
};

const bindUpdateTriggers = (): void => {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void runUpdateCheck();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      void runUpdateCheck();
    }
  });
  window.addEventListener("focus", () => {
    void runUpdateCheck();
  });
  periodicTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void runUpdateCheck();
    }
  }, PERIODIC_CHECK_MS);
};

export const startPwaUpdateSupervisor = (): void => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  activateWaitingWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      markUpdateReady();
    },
    onRegisteredSW: (
      _scriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => {
      if (!registration) {
        return;
      }
      swRegistration = registration;
      watchRegistration(registration);
      void runUpdateCheck();
    },
  });

  bindUpdateTriggers();
};

export const stopPwaUpdateSupervisorForTests = (): void => {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
};
