import { createRoot } from "react-dom/client";
import { LaunchMenu } from "./ui/launch-menu";
import { startGameFromMenu } from "./game-start";

const el = document.getElementById("react-root");
if (el) {
  const root = createRoot(el);
  root.render(
    <LaunchMenu
      onNewGame={() => {
        startGameFromMenu(false);
      }}
      onContinue={() => {
        startGameFromMenu(true);
      }}
    />,
  );
}
