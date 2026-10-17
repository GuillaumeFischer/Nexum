export function createGameMenu({
  root,
  button,
  canOpen,
  hasOtherPanel,
  releaseKeys,
}) {
  let returnFocus = null;
  function open() {
    if (!canOpen() || root.open) return;
    returnFocus = document.activeElement;
    releaseKeys();
    root.showModal();
    document.getElementById("resumeGame").focus();
  }
  function close() {
    if (!root.open) return;
    releaseKeys();
    root.close();
    returnFocus?.focus();
  }
  button.onclick = open;
  document.getElementById("resumeGame").onclick = close;
  root.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  addEventListener(
    "keydown",
    (event) => {
      if (root.open) {
        if (event.code === "Escape") {
          event.preventDefault();
          if (!event.repeat) close();
        }
        // Keep Tab, arrows, Enter and Space inside the native modal dialog.
        event.stopImmediatePropagation();
        return;
      }
      if (
        event.code !== "Escape" ||
        !canOpen() ||
        hasOtherPanel() ||
        event.defaultPrevented
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) open();
    },
    { capture: true },
  );
  return {
    open,
    close,
    get opened() {
      return root.open;
    },
  };
}
