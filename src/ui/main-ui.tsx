import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

/**
 * Mounts the React overlay once the DOM is ready.
 */
export const mountUi = (): void => {
  const el = document.getElementById("react-root");
  if (!el) {
    return;
  }
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};
