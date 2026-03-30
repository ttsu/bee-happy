import type { Engine } from "excalibur";
import { backgroundMusicSound } from "../resources";

let started = false;

/**
 * Starts the background music if it is not already playing.
 * Call from a user gesture (e.g. after menu choice) so the browser allows playback.
 * Pass the running engine so the preloaded {@link backgroundMusicSound} is wired to Web Audio.
 */
export const startBackgroundMusic = (engine: Engine): void => {
  if (started) {
    return;
  }
  started = true;
  backgroundMusicSound.wireEngine(engine);
  backgroundMusicSound.loop = true;
  backgroundMusicSound.volume = 0.45;
  void backgroundMusicSound.play().catch((err: unknown) => {
    console.warn("Background music could not play:", err);
  });
};
