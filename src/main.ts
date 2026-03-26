import { Color, DisplayMode, Engine, FadeInOut } from "excalibur";
import { loader } from "./resources";
import { MyLevel } from "./level";
import { mountUi } from "./ui/main-ui";

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
