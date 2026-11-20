import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Character } from "../types";
import { readImageFile } from "../imageFiles";

type CellViewerProps = {
  // Characters on the pressed cell, already ordered DEAD FIRST then living.
  characters: Character[];
  areaName: string;
  onClose: () => void;
  // Set or clear a fallen character's custom dead-body image.
  onSetDeadBodyImage: (characterId: string, image: string | undefined) => void;
};

// Minimum pointer travel (in px) along the dominant axis before a release is
// treated as a swipe rather than a tap.
const SWIPE_THRESHOLD = 48;

// Read the first image on the clipboard as a data URL. Resolves undefined when
// no image is present; rejects when the Clipboard read API is unavailable or
// denied so the caller can fall back to the file picker.
const readClipboardImage = async (): Promise<string | undefined> => {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
    throw new Error("Clipboard image read is not supported in this browser.");
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((candidate) => candidate.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The clipboard image could not be read."));
      reader.readAsDataURL(blob);
    });
  }
  return undefined;
};

export default function CellViewer({ characters, areaName, onClose, onSetDeadBodyImage }: CellViewerProps) {
  const [index, setIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);

  const count = characters.length;
  const current = characters[Math.min(index, count - 1)];
  const isDead = current?.status === "dead";
  const hasCustomBody = Boolean(current?.deadBodyImage);
  // Dead with a custom image shows that image; dead without shows the greyed
  // portrait; living shows the normal portrait.
  const imageSrc = current?.deadBodyImage ?? current?.portrait;
  const greyed = isDead && !hasCustomBody;

  const goTo = (next: number) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  };
  // Swiping back from the first image exits the viewer; otherwise step back.
  const goPrev = () => {
    if (index === 0) {
      onClose();
      return;
    }
    goTo(index - 1);
  };
  const goNext = () => {
    if (index >= count - 1) return;
    goTo(index + 1);
  };

  // Paste acts only on a dead body with no custom image yet. Runs under the
  // user gesture (swipe-up / button) so the Clipboard read prompt is allowed.
  const handlePaste = async () => {
    if (!current || !isDead || hasCustomBody) return;
    try {
      const image = await readClipboardImage();
      if (image) {
        onSetDeadBodyImage(current.id, image);
      }
    } catch {
      // Safari/iOS and unsupported browsers fall back to a file picker.
      fileInputRef.current?.click();
    }
  };

  const handleFilePicked = async (file: File | undefined) => {
    if (!current || !file) return;
    try {
      const image = await readImageFile(file);
      onSetDeadBodyImage(current.id, image);
    } catch {
      // Ignore unreadable files; the viewer has no HUD to surface an error.
    }
  };

  // Remove acts only on a dead body WITH a custom image; reverts to greyed.
  const handleRemove = () => {
    if (!current || !isDead || !hasCustomBody) return;
    onSetDeadBodyImage(current.id, undefined);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") goPrev();
      else if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    gestureStart.current = { x: event.clientX, y: event.clientY };
  };

  // Resolve the gesture by its dominant axis so vertical (paste/remove) and
  // horizontal (prev/next) swipes never collide. A short press closes nothing;
  // only an explicit backdrop tap closes.
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    } else if (dy < 0) {
      void handlePaste();
    } else {
      handleRemove();
    }
  };

  if (!current) return null;

  // No visible HUD: just the image. Navigation is swipe left/right, paste is
  // swipe up, remove is swipe down, and swiping back from the first image (or
  // a backdrop tap / Escape) closes the viewer.
  return (
    <div className="cell-viewer" role="dialog" aria-modal="true" aria-label={`Fallen and survivors at ${areaName}`}>
      <div className="cell-viewer-backdrop" onClick={onClose} />
      <div
        className="cell-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (gestureStart.current = null)}
      >
        <img className={`cell-viewer-image${greyed ? " is-defeated" : ""}`} src={imageSrc} alt={current.name} draggable={false} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="visually-hidden-input"
        onChange={(event) => {
          void handleFilePicked(event.target.files?.[0] ?? undefined);
          event.target.value = "";
        }}
      />
    </div>
  );
}
