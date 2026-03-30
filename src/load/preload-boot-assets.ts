import { backgroundMusicSound, beeImage } from "../resources";

/**
 * Preloads all Excalibur loadables used by the game so the launch menu appears quickly
 * after a short boot screen.
 */
export const preloadBootAssets = async (): Promise<void> => {
  await Promise.all([beeImage.load(), backgroundMusicSound.load()]);
};
