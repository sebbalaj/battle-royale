import { useEffect, useRef, useState } from "react";
import { copyText } from "../clipboard";
import { joinRoundText } from "../game";
import type { Campaign, Character } from "../types";
import { WEAPON_NAMES } from "../weapons";
import CellViewer from "./CellViewer";
import MapBoard from "./MapBoard";
import RoundTextDrawer from "./RoundTextDrawer";

type GameScreenProps = {
  campaign: Campaign;
  onAdvance: () => void;
  onEditSetup: () => void;
  onGenerateConflict: () => void;
  onSetDeadBodyImage: (characterId: string, image: string | undefined) => void;
};

export default function GameScreen({ campaign, onAdvance, onEditSetup, onGenerateConflict, onSetDeadBodyImage }: GameScreenProps) {
  const [textDrawerOpen, setTextDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewerAreaId, setViewerAreaId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [portraitScale, setPortraitScale] = useState(1.6);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const { game } = campaign;

  // Real OS-level fullscreen via the Fullscreen API on the map panel element.
  // This scales the existing element natively, so the cell layout and click
  // handling are unchanged. Desktop only; "f" toggles it, and the browser's
  // own Escape exit stays in sync through the fullscreenchange event.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === mapPanelRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isDesktop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (viewerAreaId || textDrawerOpen) return;
      event.preventDefault();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else {
        void mapPanelRef.current?.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerAreaId, textDrawerOpen]);
  const activeCharacters = campaign.characters.filter((character) => character.status === "active");
  const deadCharacters = campaign.characters.filter((character) => character.status === "dead");
  const battleComplete = activeCharacters.length <= 1 && game.round > 0 && game.phase !== "outcome-hidden";
  const contestedAreaIds = game.phase === "outcome-hidden"
    ? game.pendingOutcomes.map((outcome) => outcome.areaId)
    : [];

  const advanceLabel = game.phase === "outcome-hidden"
    ? "Reveal conflicts"
    : game.round === 0
      ? "Advance first round"
      : "Advance next round";

  // Generate-conflict needs at least two living characters sitting alone on
  // their own cells; a pending reveal or a finished battle disables it.
  const livingByArea = new Map<string, number>();
  for (const character of activeCharacters) livingByArea.set(character.areaId, (livingByArea.get(character.areaId) ?? 0) + 1);
  const eligibleForConflict = activeCharacters.filter((character) => livingByArea.get(character.areaId) === 1).length;
  const canGenerateConflict = game.phase !== "outcome-hidden" && !battleComplete && eligibleForConflict >= 2;

  const handleCopyBoth = async () => {
    await copyText(joinRoundText(game.currentBasicText, game.currentConflictText));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  // Characters on the held cell, ordered DEAD FIRST then living, for the viewer.
  const viewerCharacters: Character[] = viewerAreaId
    ? [
        ...deadCharacters.filter((character) => character.areaId === viewerAreaId),
        ...activeCharacters.filter((character) => character.areaId === viewerAreaId),
      ]
    : [];
  const viewerArea = viewerAreaId ? campaign.areas.find((area) => area.id === viewerAreaId) : undefined;

  return (
    <main className="app-shell game-screen">
      <header className="game-header">
        <div>
          <p className="eyebrow">{campaign.name}</p>
          <h1>{game.round === 0 ? "The arena awaits" : `Round ${game.round}`}</h1>
        </div>
        <div className="game-header-actions">
          <div className="survivor-count"><strong>{activeCharacters.length}</strong><span>alive</span></div>
          <button className="secondary-button" onClick={onEditSetup}>Setup</button>
        </div>
      </header>

      {battleComplete && (
        <section className="champion-banner">
          <p className="eyebrow">Battle complete</p>
          <h2>{activeCharacters[0] ? `${activeCharacters[0].name} survives with ${activeCharacters[0].power} power` : "No one survived"}</h2>
        </section>
      )}

      <section className="game-layout">
        <div className="game-map-column">
          <div className={`panel map-panel${isFullscreen ? " is-fullscreen" : ""}`} ref={mapPanelRef}>
            {isFullscreen && (
              <>
                <div className="map-float-controls">
                  <button className="map-float-button map-float-button--primary" disabled={battleComplete} onClick={onAdvance}>
                    {battleComplete ? "Done" : advanceLabel}
                  </button>
                  <button className="map-float-button" disabled={!game.currentBasicText} onClick={() => void handleCopyBoth()} title="Copy basic + conflict text">
                    {copied ? "Copied" : "📋"}
                  </button>
                  <button className="map-float-button" disabled={!canGenerateConflict} onClick={onGenerateConflict} title="Teleport two characters to a shared cell">
                    ⚔️
                  </button>
                </div>
                <div className="map-scale-slider">
                  <input
                    type="range"
                    min={0.6}
                    max={4}
                    step={0.1}
                    value={portraitScale}
                    onChange={(event) => setPortraitScale(Number(event.target.value))}
                    aria-label="Portrait size"
                    title="Portrait size"
                  />
                </div>
              </>
            )}
            <div className="map-status-row">
              <div>
                <span className={`phase-badge phase-badge--${game.phase}`}>
                  {game.phase === "outcome-hidden" ? "Outcome hidden on map" : game.phase === "revealed" ? "Results revealed" : "Ready"}
                </span>
              </div>
            </div>
            <div className="game-action-dock">
              <button className="primary-button advance-button" disabled={battleComplete} onClick={onAdvance}>
                {battleComplete ? "Battle complete" : advanceLabel}
              </button>
              <div className="dock-actions">
                <button
                  className="round-text-button"
                  disabled={!game.currentBasicText}
                  onClick={() => setTextDrawerOpen(true)}
                >
                  <span>Round text</span>
                  <small>{game.currentConflictText ? "Basic + conflict" : game.currentBasicText ? "Basic" : "Available after movement"}</small>
                </button>
                <div className="dock-mini-row">
                  <button
                    className="dock-mini-button"
                    disabled={!game.currentBasicText}
                    onClick={() => void handleCopyBoth()}
                    title="Copy basic + conflict text"
                  >
                    <span aria-hidden="true">📋</span>
                    <small>{copied ? "Copied" : "Copy both"}</small>
                  </button>
                  <button
                    className="dock-mini-button"
                    disabled={!canGenerateConflict}
                    onClick={onGenerateConflict}
                    title="Teleport two characters to a shared cell"
                  >
                    <span aria-hidden="true">⚔️</span>
                    <small>Conflict</small>
                  </button>
                </div>
              </div>
            </div>
            <MapBoard
              mapImage={campaign.mapImage}
              areas={campaign.areas}
              characters={campaign.characters}
              contestedAreaIds={contestedAreaIds}
              weapons={campaign.weapons}
              crates={campaign.crates}
              healingPoints={campaign.healingPoints}
              dangerPoints={campaign.dangerPoints}
              sniperShots={game.phase === "outcome-hidden" ? game.pendingSniperShots : []}
              onAreaHold={(areaId) => setViewerAreaId(areaId)}
              characterScale={isFullscreen ? portraitScale : 1}
            />
          </div>
        </div>

        <aside className="roster-panel panel">
          <div className="section-heading"><h2>Roster</h2><span>{campaign.characters.length} total</span></div>
          <div className="roster-list">
            {[...activeCharacters, ...deadCharacters].map((character) => {
              const area = campaign.areas.find((candidate) => candidate.id === character.areaId);
              return (
                <article className={`roster-item${character.status === "dead" ? " is-defeated" : ""}`} key={character.id}>
                  <img src={character.portrait} alt="" />
                  <div className="roster-details">
                    <div className="roster-name-row">
                      <strong>{character.name}</strong>
                      {character.invulnerable && <span className="invulnerable-mark" title="Invulnerable">◆</span>}
                    </div>
                    <span>{character.status === "dead" ? character.deathCause ?? `Died in round ${character.diedInRound}` : area?.name}</span>
                    {character.status !== "dead" && (character.weapon || character.rangedWeapon) && (
                      <span className="roster-weapon">
                        {[character.weapon, character.rangedWeapon]
                          .filter((weapon): weapon is NonNullable<typeof weapon> => Boolean(weapon))
                          .map((weapon) => WEAPON_NAMES[weapon])
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                  <div className="power-value"><strong>{character.power}</strong><span>power</span></div>
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      {game.history.length > 0 && (
        <section className="panel history-panel">
          <div className="section-heading"><h2>Round history</h2><span>Saved locally</span></div>
          <div className="history-list">
            {[...game.history].reverse().map((record) => (
              <details key={record.round}>
                <summary><span>Round {record.round}</span><span>{record.conflicts.length} conflict{record.conflicts.length === 1 ? "" : "s"} · {record.revealed ? "revealed" : "hidden on map"}</span></summary>
                <pre>{record.basicText}</pre>
                {record.conflictText && <pre className="history-conflict">{record.conflictText}</pre>}
              </details>
            ))}
          </div>
        </section>
      )}

      {textDrawerOpen && game.currentBasicText && (
        <RoundTextDrawer
          basicText={game.currentBasicText}
          conflictText={game.currentConflictText}
          onClose={() => setTextDrawerOpen(false)}
        />
      )}

      {viewerAreaId && viewerCharacters.length > 0 && (
        <CellViewer
          characters={viewerCharacters}
          areaName={viewerArea?.name ?? ""}
          onClose={() => setViewerAreaId(null)}
          onSetDeadBodyImage={onSetDeadBodyImage}
          container={isFullscreen ? mapPanelRef.current : null}
        />
      )}
    </main>
  );
}
