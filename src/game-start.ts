import { Color, DisplayMode, Engine, FadeInOut } from "excalibur";
import { acknowledgeCurrentReleaseIfUnset } from "./changelog/last-seen-release";
import { startBackgroundMusic } from "./audio/background-music";
import { gameLoader } from "./resources";
import { setPendingGameStart } from "./game-session";
import { MyLevel } from "./level";
import { mountUi } from "./ui/main-ui";

let started = false;

/**
 * Starts the Excalibur scene after the player picks an option on the launch menu.
 * @param loadSaveSlotId - When set, that slot is loaded; when null, a new colony is started (session slot is set separately for new games).
 */
export const startGameFromMenu = (loadSaveSlotId: string | null): void => {
  if (started) {
    return;
  }
  acknowledgeCurrentReleaseIfUnset();
  started = true;
  document.body.classList.add("bee-happy-game-started");
  setPendingGameStart({ loadSaveSlotId });

  const game = new Engine({
    width: 800,
    height: 600,
    displayMode: DisplayMode.FitScreenAndFill,
    pixelArt: true,
    canvasElementId: "game-canvas",
    suppressPlayButton: true,
    scenes: {
      start: MyLevel,
    },
  });

  startBackgroundMusic(game);

  game
    .start("start", {
      loader: gameLoader,
      inTransition: new FadeInOut({
        duration: 800,
        direction: "in",
        color: Color.fromHex("#1b2838"),
      }),
    })
    .then(() => {
      mountUi();
    });
};
