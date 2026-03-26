import { ImageSource, Loader, SpriteSheet } from "excalibur";

/** Scene boot loader; add ImageSource/Sound assets here when needed. */
export const loader = new Loader();

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

loader.addResource(beeImage);
