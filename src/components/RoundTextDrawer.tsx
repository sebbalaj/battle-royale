import { useEffect, useState } from "react";
import CopyPanel from "./CopyPanel";

type RoundTextDrawerProps = {
  basicText: string;
  conflictText: string;
  onClose: () => void;
};

type TextTab = "basic" | "conflict";

export default function RoundTextDrawer({ basicText, conflictText, onClose }: RoundTextDrawerProps) {
  const [tab, setTab] = useState<TextTab>(conflictText ? "conflict" : "basic");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="round-text-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Round text"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div><p className="eyebrow">Ready to copy</p><h2>Round text</h2></div>
          <button className="drawer-close" onClick={onClose} aria-label="Close round text">×</button>
        </header>
        <div className="drawer-tabs" role="tablist" aria-label="Text type">
          <button role="tab" aria-selected={tab === "basic"} className={tab === "basic" ? "is-active" : ""} onClick={() => setTab("basic")}>Basic round</button>
          <button role="tab" aria-selected={tab === "conflict"} className={tab === "conflict" ? "is-active" : ""} disabled={!conflictText} onClick={() => setTab("conflict")}>Conflict</button>
        </div>
        <div className="drawer-content">
          {tab === "basic" ? (
            <CopyPanel
              title="Basic round"
              description="Movements, power changes, accidents, and major events."
              text={basicText}
            />
          ) : (
            <CopyPanel
              title="Conflict"
              description="Fight results, damage, deaths or escapes, and randomized story entries."
              text={conflictText}
              accent
            />
          )}
        </div>
      </aside>
    </div>
  );
}
