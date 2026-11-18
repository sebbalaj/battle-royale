import type { Campaign } from "../types";
import CopyPanel from "./CopyPanel";
import MapBoard from "./MapBoard";

type GameScreenProps = {
  campaign: Campaign;
  onAdvance: () => void;
  onEditSetup: () => void;
};

export default function GameScreen({ campaign, onAdvance, onEditSetup }: GameScreenProps) {
  const { game } = campaign;
  const activeCharacters = campaign.characters.filter((character) => character.status === "active");
  const defeatedCharacters = campaign.characters.filter((character) => character.status === "defeated");
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
          <div className="survivor-count"><strong>{activeCharacters.length}</strong><span>active</span></div>
          <button className="secondary-button" onClick={onEditSetup}>Setup</button>
        </div>
      </header>

      {battleComplete && (
        <section className="champion-banner">
          <p className="eyebrow">Battle complete</p>
          <h2>{activeCharacters[0] ? `${activeCharacters[0].name} survives` : "No one survived"}</h2>
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
                {game.phase === "outcome-hidden" && <p>Conflict winners are included in the copyable conflict text, but the map will not grey out losers until Reveal.</p>}
              </div>
            </div>
            <MapBoard
              mapImage={campaign.mapImage}
              areas={campaign.areas}
              characters={campaign.characters}
              contestedAreaIds={contestedAreaIds}
            />
          </div>

          <button className="primary-button advance-button" disabled={battleComplete} onClick={onAdvance}>
            {battleComplete ? "Battle complete" : advanceLabel}
          </button>
        </div>

        <aside className="roster-panel panel">
          <div className="section-heading"><h2>Roster</h2><span>{campaign.characters.length} total</span></div>
          <div className="roster-list">
            {[...activeCharacters, ...defeatedCharacters].map((character) => {
              const area = campaign.areas.find((candidate) => candidate.id === character.areaId);
              return (
                <article className={`roster-item${character.status === "defeated" ? " is-defeated" : ""}`} key={character.id}>
                  <img src={character.portrait} alt="" />
                  <div><strong>{character.name}</strong><span>{character.status === "defeated" ? `Defeated in round ${character.defeatedInRound}` : area?.name}</span></div>
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      {game.currentBasicText && (
        <section className="copy-section">
          <div className="section-title-row"><div><p className="eyebrow">AI text ingredients</p><h2>Round copy</h2></div></div>
          <div className="copy-grid">
            <CopyPanel
              title="Basic round"
              description="Movements and major events, without conflict results."
              text={game.currentBasicText}
            />
            {game.currentConflictText && (
              <CopyPanel
                title="Conflict"
                description="Includes the winner and up to 12 randomized words or phrases."
                text={game.currentConflictText}
                accent
              />
            )}
          </div>
        </section>
      )}

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
    </main>
  );
}
