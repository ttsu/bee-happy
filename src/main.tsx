import {
  ensureActiveSaveSlotForNewGame,
  setActiveSaveSlotSession,
} from "./colony/colony-save";
import type { NewGameOptions } from "./colony/game-settings";
import { BootRoot } from "./ui/boot-root";
import { LaunchMenu } from "./ui/launch-menu";
import { startGameFromMenu } from "./game-start";
import { getReactRoot } from "./ui/react-root";

if (document.getElementById("react-root")) {
  getReactRoot().render(
    <BootRoot>
      <LaunchMenu
        onStartNewGame={(opts: NewGameOptions) => {
          ensureActiveSaveSlotForNewGame();
          startGameFromMenu(null, opts);
        }}
        onContinue={(slotId) => {
          setActiveSaveSlotSession(slotId);
          startGameFromMenu(slotId);
        }}
      />
    </BootRoot>,
  );
}
