import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * The PWA update affordance (Stage 18 / Axis 5). registerType 'prompt' means a
 * new service worker installs but WAITS — this toast tells the user a new
 * revision is ready and lets them choose the moment to reload (the changelog
 * idiom: each revision has a story, so the update is a deliberate act, not a
 * silent swap under the user). offlineReady is intentionally ignored — a
 * first-visit "ready to work offline" banner would just be noise.
 *
 * updateServiceWorker(true) activates the waiting worker and reloads, so the
 * page comes back controlled by the new build.
 */
export function UpdateToast(): React.ReactElement | null {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="alert">
      <span className="update-toast-label">REVISION AVAILABLE</span>
      <button
        type="button"
        className="update-toast-action"
        onClick={() => void updateServiceWorker(true)}
      >
        RELOAD
      </button>
    </div>
  );
}
