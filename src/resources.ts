import { ImageSource, Sound, SpriteSheet } from "excalibur";
import { BeeHappyLoader } from "./load/bee-happy-loader";

/** Scene boot loader; add ImageSource/Sound assets here when needed. */
export const gameLoader = new BeeHappyLoader();

export const beeImage = new ImageSource("/images/bee.png");

/**
 * 4-frame horizontal bee sheet where each frame is 128x128 px.
 */
export const beeSpriteSheet = SpriteSheet.fromImageSource({
  image: beeImage,
  grid: {
    rows: 1,
    columns: 4,
    spriteWidth: 128,
    spriteHeight: 128,
  },
});

/** Looped background track (also preloaded at boot). Playback starts after menu choice. */
export const backgroundMusicSound = new Sound({
  paths: ["/sound/Cozy Hive Workshop.mp3"],
  loop: true,
  volume: 0.45,
});

gameLoader.addResource(beeImage);
gameLoader.addResource(backgroundMusicSound);
