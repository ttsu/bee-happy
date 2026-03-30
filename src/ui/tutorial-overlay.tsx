import { tutorialStepBodyHtml, TUTORIAL_STEP_COUNT } from "../tutorial/tutorial-steps";

type Props = {
  readonly stepIndex: number;
  readonly advanceContinue: () => void;
  readonly completeTutorial: () => void;
  readonly skipTutorial: () => void;
};

const CONTINUE_STEPS = new Set([0, 1, 9, 10]);

/**
 * Bottom-sheet style tutorial that does not block the canvas (pointer-events pass through except on the card).
 */
export const TutorialOverlay = ({
  stepIndex,
  advanceContinue,
  completeTutorial,
  skipTutorial,
}: Props) => {
  const body = tutorialStepBodyHtml[stepIndex] ?? "";
  const showContinue = CONTINUE_STEPS.has(stepIndex);
  const showDone = stepIndex === TUTORIAL_STEP_COUNT - 1;

  return (
    <div className="tutorial-overlay" aria-live="polite">
      <div
        className="tutorial-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
      >
        <h2 id="tutorial-title" className="tutorial-title">
          Tutorial
        </h2>
        <p className="tutorial-body" dangerouslySetInnerHTML={{ __html: body }} />
        <div className="tutorial-actions">
          {showContinue ? (
            <button
              type="button"
              className="tutorial-btn tutorial-btn--primary"
              onClick={advanceContinue}
            >
              Continue
            </button>
          ) : null}
          {showDone ? (
            <button
              type="button"
              className="tutorial-btn tutorial-btn--primary"
              onClick={completeTutorial}
            >
              Done
            </button>
          ) : null}
          <button
            type="button"
            className="tutorial-btn tutorial-btn--skip"
            onClick={skipTutorial}
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
};
