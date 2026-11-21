import { useEffect, useRef, useState } from "react";
import GameScreen from "./components/GameScreen";
import SettingsScreen from "./components/SettingsScreen";
import SetupScreen from "./components/SetupScreen";
import { createDefaultCampaign, createDefaultSavedMap, emptyGameState, migrateCampaign } from "./data";
import { buildRoundZeroIntro, revealOutcomes, runGeneratedConflict, runRound } from "./game";
import { listMaps, listRosterCharacters, loadCampaign, saveCampaign, saveMap, saveRosterCharacter } from "./storage";
import type { Campaign } from "./types";

export default function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [storageError, setStorageError] = useState("");
  const hasLoaded = useRef(false);

  useEffect(() => {
    void loadCampaign()
      .then(async (savedCampaign) => {
        const loaded = migrateCampaign(savedCampaign) ?? createDefaultCampaign();
        // Seed the map library on first run: if the store is empty, persist the
        // live board as a SavedMap keyed by the campaign's activeMapId so a v5
        // default campaign has exactly one matching map. Non-destructive: an
        // existing library is left untouched.
        try {
          const maps = await listMaps();
          if (maps.length === 0 && loaded.activeMapId) {
            await saveMap(createDefaultSavedMap(loaded, loaded.activeMapId));
          }
          // Seed the persistent roster from the live characters on first run so
          // the 'characters' store becomes the durable source going forward.
          const roster = await listRosterCharacters();
          if (roster.length === 0) {
            await Promise.all(loaded.characters.map((character) => saveRosterCharacter(character)));
          }
        } catch {
          // Seeding is best-effort; a storage failure is surfaced by autosave.
        }
        setCampaign(loaded);
      })
      .catch(() => {
        setStorageError("Local saving is unavailable in this browser session.");
        setCampaign(createDefaultCampaign());
      })
      .finally(() => {
        hasLoaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!campaign || !hasLoaded.current) return;
    const timeout = window.setTimeout(() => {
      void saveCampaign(campaign).catch(() => setStorageError("Changes could not be saved locally."));
      // Mirror the working copy into the persistent roster so edits to names,
      // attires, weapons, sit-out, etc. survive resets/new-game/import. The
      // roster store is only added to (put), never wiped, so sitting-out and
      // past characters are retained even while a game is running.
      void Promise.all(campaign.characters.map((character) => saveRosterCharacter(character))).catch(() => {
        /* roster sync is best-effort; the campaign autosave is authoritative. */
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [campaign]);

  if (!campaign) {
    return <div className="loading-screen"><div className="loading-mark">BR</div><p>Loading local campaign…</p></div>;
  }

  const startBattle = () => {
    // Sit-out characters do not join: they are dropped from the live board for
    // this game. Their definitions remain in setup (and the roster) so they
    // return next time. Non-sitting-out characters are reset to start state.
    const liveCharacters = campaign.characters
      .filter((character) => !character.sitOut)
      .map((character) => ({
        ...character,
        areaId: character.startAreaId,
        status: "active" as const,
        power: campaign.settings.startingPower,
        lastOpponentId: undefined,
        deathCause: undefined,
        diedInRound: undefined,
        deadBodyImage: undefined,
      }));
    const started: Campaign = { ...campaign, screen: "game", characters: liveCharacters, game: emptyGameState() };
    setCampaign({
      ...started,
      game: {
        ...started.game,
        // Round 0 is the pre-battle stage: surface the attire intro as the
        // current round text so GameScreen shows what everyone is wearing
        // before the first Advance. buildRoundZeroIntro reads the live roster.
        currentBasicText: buildRoundZeroIntro(started),
      },
    });
  };

  const advance = () => {
    setCampaign((current) => {
      if (!current) return current;
      return current.game.phase === "outcome-hidden" ? revealOutcomes(current) : runRound(current);
    });
  };

  const generateConflict = () => {
    setCampaign((current) => {
      if (!current) return current;
      if (current.game.phase === "outcome-hidden") return current;
      return runGeneratedConflict(current);
    });
  };

  // Set or clear a fallen character's custom dead-body image. Flows through
  // setCampaign so the debounced IndexedDB autosave persists the change.
  const setDeadBodyImage = (characterId: string, image: string | undefined) => {
    setCampaign((current) => {
      if (!current) return current;
      return {
        ...current,
        characters: current.characters.map((character) =>
          character.id === characterId ? { ...character, deadBodyImage: image } : character,
        ),
      };
    });
  };

  const editSetup = () => {
    if (campaign.game.round > 0 && !window.confirm("Return to setup? Starting again will reset the current battle.")) return;
    setCampaign({ ...campaign, screen: "setup" });
  };

  const openSettings = () => setCampaign({ ...campaign, screen: "settings" });
  const backToSetup = () => setCampaign({ ...campaign, screen: "setup" });

  // Load an imported backup into app state (storage is already written by the
  // importer); force the setup screen so the user lands somewhere stable.
  const importCampaign = (imported: Campaign) => setCampaign({ ...imported, screen: "setup" });

  const resetPlaceholders = () => {
    if (!window.confirm("Replace the current local campaign with all placeholder content?")) return;
    setCampaign(createDefaultCampaign());
  };

  return (
    <>
      {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
      {campaign.screen === "settings" ? (
        <SettingsScreen campaign={campaign} onChange={setCampaign} onBack={backToSetup} />
      ) : campaign.screen === "setup" ? (
        <SetupScreen campaign={campaign} onChange={setCampaign} onStart={startBattle} onReset={resetPlaceholders} onOpenSettings={openSettings} onImport={importCampaign} />
      ) : (
        <GameScreen
          campaign={campaign}
          onAdvance={advance}
          onEditSetup={editSetup}
          onGenerateConflict={generateConflict}
          onSetDeadBodyImage={setDeadBodyImage}
        />
      )}
    </>
  );
}
