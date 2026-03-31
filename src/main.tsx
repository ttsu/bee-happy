import { createRoot } from "react-dom/client";
import {
  ensureActiveSaveSlotForNewGame,
  setActiveSaveSlotSession,
} from "./colony/colony-save";
import { BootRoot } from "./ui/boot-root";
import { LaunchMenu } from "./ui/launch-menu";
import { startGameFromMenu } from "./game-start";

const el = document.getElementById("react-root");
if (el) {
  const root = createRoot(el);
  root.render(
    <BootRoot>
      <LaunchMenu
        onNewGame={() => {
          ensureActiveSaveSlotForNewGame();
          startGameFromMenu(null);
        }}
        onContinue={(slotId) => {
          setActiveSaveSlotSession(slotId);
          startGameFromMenu(slotId);
        }}
      />
    </BootRoot>,
  );
}
