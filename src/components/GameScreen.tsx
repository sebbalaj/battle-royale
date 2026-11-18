import { useState } from "react";
import type { Campaign } from "../types";
import MapBoard from "./MapBoard";
import RoundTextDrawer from "./RoundTextDrawer";

type GameScreenProps = {
  campaign: Campaign;
  onAdvance: () => void;
  onEditSetup: () => void;
};

export default function GameScreen({ campaign, onAdvance, onEditSetup }: GameScreenProps) {
  const [textDrawerOpen, setTextDrawerOpen] = useState(false);
  const { game } = campaign;
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
          <div className="panel map-panel">
            <div className="map-status-row">
              <div>
                <span className={`phase-badge phase-badge--${game.phase}`}>
                  {game.phase === "outcome-hidden" ? "Outcome hidden on map" : game.phase === "revealed" ? "Results revealed" : "Ready"}
                </span>
                {game.phase === "outcome-hidden" && <p>Open Round text to read the result. The map remains unchanged until Reveal.</p>}
              </div>
            </div>
            <div className="game-action-dock">
              <button className="primary-button advance-button" disabled={battleComplete} onClick={onAdvance}>
                {battleComplete ? "Battle complete" : advanceLabel}
              </button>
              <button
                className="round-text-button"
                disabled={!game.currentBasicText}
                onClick={() => setTextDrawerOpen(true)}
              >
                <span>Round text</span>
                <small>{game.currentConflictText ? "Basic + conflict" : game.currentBasicText ? "Basic" : "Available after movement"}</small>
              </button>
            </div>
            <MapBoard
              mapImage={campaign.mapImage}
              areas={campaign.areas}
              characters={campaign.characters}
              contestedAreaIds={contestedAreaIds}
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
    </main>
  );
}
