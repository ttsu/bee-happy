import { useEffect, useState } from "react";
import {
  applyPwaUpdate,
  dismissUpdatePrompt,
  isUpdatePromptVisible,
  subscribeToUpdateAvailable,
} from "./register-pwa-updates";

export const usePwaUpdatePrompt = (): {
  readonly visible: boolean;
  readonly dismiss: () => void;
  readonly apply: () => void;
} => {
  const [visible, setVisible] = useState(isUpdatePromptVisible);

  useEffect(
    () =>
      subscribeToUpdateAvailable(() => {
        setVisible(isUpdatePromptVisible());
      }),
    [],
  );

  return {
    visible,
    dismiss: dismissUpdatePrompt,
    apply: () => {
      void applyPwaUpdate();
    },
  };
};
