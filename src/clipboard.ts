// Copy text to the clipboard. Uses the async Clipboard API when available and
// falls back to a hidden textarea + execCommand("copy") for older browsers.
// Shared by CopyPanel and the game-screen copy-both button.
export const copyText = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }
};
