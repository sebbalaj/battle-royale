import { useEffect, useRef, useState } from "react";
import GameScreen from "./components/GameScreen";
import SettingsScreen from "./components/SettingsScreen";
import SetupScreen from "./components/SetupScreen";
import { createDefaultCampaign, emptyGameState, migrateCampaign } from "./data";
import { revealOutcomes, runGeneratedConflict, runRound } from "./game";
import { loadCampaign, saveCampaign } from "./storage";
import type { Campaign } from "./types";

export default function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [storageError, setStorageError] = useState("");
  const hasLoaded = useRef(false);

  useEffect(() => {
    void loadCampaign()
      .then((savedCampaign) => setCampaign(migrateCampaign(savedCampaign) ?? createDefaultCampaign()))
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
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [campaign]);

  if (!campaign) {
    return <div className="loading-screen"><div className="loading-mark">BR</div><p>Loading local campaign…</p></div>;
  }

  const startBattle = () => {
    setCampaign({
      ...campaign,
      screen: "game",
      characters: campaign.characters.map((character) => ({
        ...character,
        areaId: character.startAreaId,
        status: "active",
        power: campaign.settings.startingPower,
        lastOpponentId: undefined,
        deathCause: undefined,
        diedInRound: undefined,
        deadBodyImage: undefined,
      })),
      game: emptyGameState(),
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
        <SetupScreen campaign={campaign} onChange={setCampaign} onStart={startBattle} onReset={resetPlaceholders} onOpenSettings={openSettings} />
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
