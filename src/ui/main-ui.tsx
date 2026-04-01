import { StrictMode } from "react";
import { App } from "./app";
import { ColonyBridgeProvider } from "./colony-bridge-context";
import { getReactRoot } from "./react-root";

/**
 * Swaps the launch menu tree for the in-game HUD using the same React root as
 * {@link getReactRoot} in `main.tsx`.
 */
export const mountUi = (): void => {
  getReactRoot().render(
    <StrictMode>
      <ColonyBridgeProvider>
        <App />
      </ColonyBridgeProvider>
    </StrictMode>,
  );
};
