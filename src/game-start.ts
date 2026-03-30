import { Color, DisplayMode, Engine, FadeInOut } from "excalibur";
import { acknowledgeCurrentReleaseIfUnset } from "./changelog/last-seen-release";
import { loader } from "./resources";
import { MyLevel } from "./level";
import { mountUi } from "./ui/main-ui";

let started = false;

/**
 * Starts the Excalibur scene after the player picks an option on the launch menu.
 */
export const startGameFromMenu = (loadSaved: boolean): void => {
  if (started) {
    return;
  }
  acknowledgeCurrentReleaseIfUnset();
  started = true;
  document.body.classList.add("bee-happy-game-started");
  MyLevel.loadSaveOnStart = loadSaved;

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

  game
    .start("start", {
      loader,
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
