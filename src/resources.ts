import { ImageSource, Sound, SpriteSheet } from "excalibur";
import { TiledResource } from "@excaliburjs/plugin-tiled";
import { BeeHappyLoader } from "./load/bee-happy-loader";

/** Scene boot loader; add ImageSource/Sound assets here when needed. */
export const gameLoader = new BeeHappyLoader();

const publicAsset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export const beeImage = new ImageSource(publicAsset("/images/bee.png"));

/** 4×4 hive cell art; each sprite is 246×280 px (see `drawHiveCells`). */
export const cellSpritesImage = new ImageSource(publicAsset("/images/cell_sprites.png"));

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
  paths: [publicAsset("/sound/Cozy Hive Workshop.mp3")],
  loop: true,
  volume: 0.45,
});

export const terrainMapResource = new TiledResource(publicAsset("/tiled/terrain.tmx"), {
  // Ensure the background is below all other gameplay visuals.
  startZIndex: -10_000,
  // We'll apply our own camera bounds based on the map size/position, but keep
  // the plugin's default wiring behavior.
  useTilemapCameraStrategy: false,
});

gameLoader.addResource(beeImage);
gameLoader.addResource(cellSpritesImage);
gameLoader.addResource(backgroundMusicSound);
gameLoader.addResource(terrainMapResource);
