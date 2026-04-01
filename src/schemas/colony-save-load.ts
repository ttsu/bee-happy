import { z } from "zod";
import { SAVE_FORMAT_VERSION } from "../colony/save/colony-save-types";
import type { ColonySaveV1 } from "../colony/save/colony-save-types";

/**
 * Minimal validation at load: format version + required top-level keys; rest passthrough.
 */
const colonySaveV1LoadSchema = z
  .object({
    formatVersion: z.literal(SAVE_FORMAT_VERSION),
    savedAtIso: z.string(),
    camera: z.object({ x: z.number(), y: z.number() }),
    cells: z.array(z.unknown()),
    jobs: z.array(z.unknown()),
    bees: z.array(z.unknown()),
  })
  .passthrough();

/**
 * Parses persisted JSON; returns null if malformed or wrong format version.
 */
export const parseColonySavePayload = (parsed: unknown): ColonySaveV1 | null => {
  const r = colonySaveV1LoadSchema.safeParse(parsed);
  return r.success ? (r.data as ColonySaveV1) : null;
};
