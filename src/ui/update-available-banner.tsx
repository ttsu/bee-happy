import { usePwaUpdatePrompt } from "../pwa/use-pwa-update";

type Props = {
  readonly onBeforeApply?: () => void;
};

/**
 * In-game toast when a newer build is available. Launch menu auto-reloads instead.
 */
export const UpdateAvailableBanner = ({ onBeforeApply }: Props) => {
  const { visible, dismiss, apply } = usePwaUpdatePrompt();

  if (!visible) {
    return null;
  }

  return (
    <div
      className="update-available-banner"
      role="status"
      aria-live="polite"
      aria-label="App update available"
    >
      <p className="update-available-banner-text">Update available</p>
      <div className="update-available-banner-actions">
        <button
          type="button"
          className="update-available-banner-btn update-available-banner-btn--primary"
          onClick={() => {
            onBeforeApply?.();
            apply();
          }}
        >
          Save and reload
        </button>
        <button
          type="button"
          className="update-available-banner-btn update-available-banner-btn--secondary"
          onClick={dismiss}
        >
          Later
        </button>
      </div>
    </div>
  );
};
