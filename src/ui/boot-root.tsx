import { useEffect, useState, type ReactNode } from "react";
import { preloadBootAssets } from "../load/preload-boot-assets";

type Props = {
  readonly children: ReactNode;
};

/**
 * Full-screen boot layer that preloads Excalibur assets, then cross-fades into children
 * (the launch menu).
 */
export const BootRoot = ({ children }: Props) => {
  const [assetsReady, setAssetsReady] = useState(false);
  const [bootDismissed, setBootDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void preloadBootAssets().then(() => {
      if (!cancelled) {
        setAssetsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div
        className={`boot-content-layer ${assetsReady ? "boot-content-layer--visible" : ""}`}
        aria-hidden={!assetsReady}
      >
        {children}
      </div>
      {!bootDismissed ? (
        <div
          className={`boot-load-screen ${assetsReady ? "boot-load-screen--hide" : ""}`}
          onTransitionEnd={(e) => {
            if (e.propertyName === "opacity" && assetsReady) {
              setBootDismissed(true);
            }
          }}
          role="status"
          aria-busy={!assetsReady}
          aria-live="polite"
        >
          <div className="boot-load-screen-inner">
            <p className="boot-load-screen-title">Bee Happy</p>
            <p className="boot-load-screen-sub">Loading assets…</p>
            <div className="boot-load-screen-bar" aria-hidden>
              <div className="boot-load-screen-bar-fill boot-load-screen-bar-fill--indeterminate" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
