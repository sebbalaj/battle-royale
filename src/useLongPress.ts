import { useRef } from "react";

// Shared press-and-hold handler used by the "Switch attire" button and the
// "Switch loot preset" button. A quick tap runs onClick (cycle to the next
// item); a press held past `delay` (~500ms) runs onLongPress instead (create a
// new blank item made active) and suppresses the click that would otherwise
// follow pointerup. Returns props to spread onto a <button>.
export type LongPressHandlers = {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
};

export const useLongPress = (
  onClick: () => void,
  onLongPress: () => void,
  delay = 500,
): LongPressHandlers => {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: () => {
      longPressed.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        longPressed.current = true;
        timer.current = null;
        onLongPress();
      }, delay);
    },
    onPointerUp: () => {
      clear();
    },
    onPointerLeave: () => {
      // Pointer left the button before release: cancel the pending long-press
      // and do not fire the click (the following onClick is suppressed too).
      longPressed.current = true;
      clear();
    },
    onClick: () => {
      // Suppress the click that fires after a long-press (or a cancelled press).
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onClick();
    },
  };
};
