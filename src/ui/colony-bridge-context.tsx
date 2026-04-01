import { useSyncExternalStore, type ReactNode } from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import { getColonyBridge, subscribeColonyBridge } from "../colony-bridge";

/**
 * Optional wrapper for the in-game HUD subtree (mount point for future colony-scoped context).
 */
export const ColonyBridgeProvider = ({
  children,
}: {
  readonly children: ReactNode;
}): React.ReactElement => <>{children}</>;

/**
 * Returns the active {@link ColonyRuntime} from the bridge and re-renders when it is set.
 */
export const useColonyBridge = (): ColonyRuntime | null =>
  useSyncExternalStore(subscribeColonyBridge, getColonyBridge, getColonyBridge);
