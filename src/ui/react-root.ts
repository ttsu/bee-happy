import { createRoot, type Root } from "react-dom/client";

let root: Root | null = null;

/**
 * Returns the single React root for `#react-root`. Call {@link mountGameUi} after the
 * engine is ready to swap the launch menu for the in-game HUD without a second
 * `createRoot` (React allows one root per DOM container).
 */
export const getReactRoot = (): Root => {
  const el = document.getElementById("react-root");
  if (!el) {
    throw new Error("Missing #react-root element");
  }
  if (!root) {
    root = createRoot(el);
  }
  return root;
};
