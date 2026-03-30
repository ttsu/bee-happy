import { useCallback, useEffect, useRef, useState } from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { CellStateComponent } from "../colony/ecs/components/colony-components";
import { readTutorialStorage, writeTutorialStorage } from "./tutorial-storage";
import { TUTORIAL_STEP_COUNT } from "./tutorial-steps";

const getCellTypeAtKey = (
  colony: ColonyRuntime,
  key: string,
): "none" | "brood" | "pollen" | "nectar" | null => {
  const ent = colony.cellsByKey.get(key);
  const st = ent?.get(CellStateComponent);
  return st?.cellType ?? null;
};

type PollenNectarPhase = "await_place" | "await_built" | "await_type";

/**
 * Drives first-play tutorial step index, persistence, and colony event wiring.
 */
export const useTutorial = (
  colony: ColonyRuntime | null,
  snap: ColonyUiSnapshot,
): {
  readonly showTutorial: boolean;
  readonly stepIndex: number;
  readonly advanceContinue: () => void;
  readonly completeTutorial: () => void;
  readonly skipTutorial: () => void;
} => {
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepRef = useRef(0);
  stepRef.current = stepIndex;

  const firstFoundationKeyRef = useRef<string | null>(null);
  const secondFoundationKeyRef = useRef<string | null>(null);
  const thirdFoundationKeyRef = useRef<string | null>(null);
  const pollenPhaseRef = useRef<PollenNectarPhase>("await_place");
  const nectarPhaseRef = useRef<PollenNectarPhase>("await_place");

  const setStep = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(TUTORIAL_STEP_COUNT - 1, n));
    stepRef.current = clamped;
    setStepIndex(clamped);
  }, []);

  const stored = readTutorialStorage();
  const showTutorial =
    colony !== null && !colony.sessionStartedFromSave && !dismissed && stored === null;

  useEffect(() => {
    if (stepIndex === 5) {
      pollenPhaseRef.current = "await_place";
      secondFoundationKeyRef.current = null;
    }
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex === 6) {
      nectarPhaseRef.current = "await_place";
      thirdFoundationKeyRef.current = null;
    }
  }, [stepIndex]);

  useEffect(() => {
    if (!colony || !showTutorial) {
      return;
    }
    const off = colony.events.subscribe((e) => {
      const s = stepRef.current;
      if (e.type === "CellBuildStarted") {
        if (s === 2) {
          firstFoundationKeyRef.current = e.cellKey;
          setStep(3);
          return;
        }
        if (s === 5 && pollenPhaseRef.current === "await_place") {
          if (e.cellKey !== firstFoundationKeyRef.current) {
            secondFoundationKeyRef.current = e.cellKey;
            pollenPhaseRef.current = "await_built";
          }
          return;
        }
        if (s === 6 && nectarPhaseRef.current === "await_place") {
          const first = firstFoundationKeyRef.current;
          const second = secondFoundationKeyRef.current;
          if (e.cellKey !== first && e.cellKey !== second) {
            thirdFoundationKeyRef.current = e.cellKey;
            nectarPhaseRef.current = "await_built";
          }
        }
        return;
      }
      if (e.type === "CellBuilt") {
        if (s === 3 && e.cellKey === firstFoundationKeyRef.current) {
          setStep(4);
          return;
        }
        if (
          s === 5 &&
          pollenPhaseRef.current === "await_built" &&
          e.cellKey === secondFoundationKeyRef.current
        ) {
          pollenPhaseRef.current = "await_type";
          return;
        }
        if (
          s === 6 &&
          nectarPhaseRef.current === "await_built" &&
          e.cellKey === thirdFoundationKeyRef.current
        ) {
          nectarPhaseRef.current = "await_type";
        }
        return;
      }
      if (e.type === "CameraPanned" && s === 7) {
        setStep(8);
        return;
      }
      if (e.type === "LevelChanged" && s === 8 && e.level !== 0) {
        setStep(9);
      }
    });
    return off;
  }, [colony, showTutorial, setStep]);

  useEffect(() => {
    if (!colony || !showTutorial) {
      return;
    }
    const s = stepIndex;
    if (s === 4 && firstFoundationKeyRef.current) {
      if (getCellTypeAtKey(colony, firstFoundationKeyRef.current) === "brood") {
        setStep(5);
      }
      return;
    }
    if (
      s === 5 &&
      pollenPhaseRef.current === "await_type" &&
      secondFoundationKeyRef.current
    ) {
      if (getCellTypeAtKey(colony, secondFoundationKeyRef.current) === "pollen") {
        setStep(6);
      }
      return;
    }
    if (
      s === 6 &&
      nectarPhaseRef.current === "await_type" &&
      thirdFoundationKeyRef.current
    ) {
      if (getCellTypeAtKey(colony, thirdFoundationKeyRef.current) === "nectar") {
        setStep(7);
      }
    }
  }, [colony, showTutorial, snap, stepIndex, setStep]);

  const advanceContinue = useCallback(() => {
    const s = stepRef.current;
    if (s === 0 || s === 1 || s === 9 || s === 10) {
      setStep(s + 1);
    }
  }, [setStep]);

  const completeTutorial = useCallback(() => {
    writeTutorialStorage("done");
    setDismissed(true);
  }, []);

  const skipTutorial = useCallback(() => {
    writeTutorialStorage("skipped");
    setDismissed(true);
  }, []);

  return {
    showTutorial,
    stepIndex,
    advanceContinue,
    completeTutorial,
    skipTutorial,
  };
};
