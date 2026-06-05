/** Подключает клавиатуру и touch-кнопки к единому action handler-у. */
export function bindControls(options) {
  const repeatTimers = new Map();
  const repeatableActions = new Set(["move-left", "move-right", "soft-drop"]);

  document.addEventListener("keydown", (event) => {
    const action = mapKeyboardAction(event);
    if (!action) return;
    event.preventDefault();
    if (action === "primary") {
      options.onPrimaryAction();
      return;
    }
    options.onAction(action);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.getAttribute("data-action");

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      options.onAction(action);
      if (repeatableActions.has(action)) {
        const timer = window.setInterval(() => options.onAction(action), 90);
        repeatTimers.set(button, timer);
      }
    });

    const stopRepeat = () => {
      const timer = repeatTimers.get(button);
      if (timer) window.clearInterval(timer);
      repeatTimers.delete(button);
    };

    button.addEventListener("pointerup", stopRepeat);
    button.addEventListener("pointercancel", stopRepeat);
    button.addEventListener("pointerleave", stopRepeat);
  });
}

function mapKeyboardAction(event) {
  const key = event.key || "";
  const code = event.keyCode || event.which;
  if (key === "Enter" || code === 13) return "primary";
  if (key === "p" || key === "P" || code === 80) return "pause";
  if (key === "c" || key === "C" || key === "Shift" || code === 67 || code === 16) return "hold";
  if (key === "ArrowLeft" || code === 37) return "move-left";
  if (key === "ArrowRight" || code === 39) return "move-right";
  if (key === "ArrowUp" || code === 38) return "rotate";
  if (key === "ArrowDown" || code === 40) return "soft-drop";
  if (key === " " || key === "Spacebar" || code === 32) return "hard-drop";
  return null;
}
