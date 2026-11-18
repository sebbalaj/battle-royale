import { useMemo, useState, type ChangeEvent } from "react";
import { readImageFile } from "../imageFiles";
import { parseEntries } from "../game";
import type { Area, Campaign, Character } from "../types";
import MapBoard from "./MapBoard";

type SetupScreenProps = {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
  onStart: () => void;
  onReset: () => void;
};

type EditTool = "select" | "place" | "connect";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

export default function SetupScreen({ campaign, onChange, onStart, onReset }: SetupScreenProps) {
  const [tool, setTool] = useState<EditTool>("select");
  const [selectedAreaId, setSelectedAreaId] = useState(campaign.areas[0]?.id ?? "");
  const [connectFromId, setConnectFromId] = useState("");
  const [imageError, setImageError] = useState("");
  const [textFileError, setTextFileError] = useState("");
  const entries = useMemo(() => parseEntries(campaign.phraseSource), [campaign.phraseSource]);
  const selectedArea = campaign.areas.find((area) => area.id === selectedAreaId);

  const updateAreas = (areas: Area[]) => onChange({ ...campaign, areas });

  const updateArea = (areaId: string, patch: Partial<Area>) => {
    updateAreas(campaign.areas.map((area) => (area.id === areaId ? { ...area, ...patch } : area)));
  };

  const handleMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const mapImage = await readImageFile(file);
      setImageError("");
      onChange({ ...campaign, mapImage });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The image could not be loaded.");
    } finally {
      event.target.value = "";
    }
  };

  const handleTextUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("Choose a text file smaller than 1 MB.");
      const phraseSource = await file.text();
      setTextFileError("");
      onChange({ ...campaign, phraseSource });
    } catch (error) {
      setTextFileError(error instanceof Error ? error.message : "The text file could not be loaded.");
    } finally {
      event.target.value = "";
    }
  };

  const addArea = (x: number, y: number) => {
    const area: Area = {
      id: crypto.randomUUID(),
      name: `Area ${campaign.areas.length + 1}`,
      x,
      y,
      radius: 0.055,
      neighborIds: [],
    };
    updateAreas([...campaign.areas, area]);
    setSelectedAreaId(area.id);
    setTool("select");
  };

  const toggleConnection = (firstId: string, secondId: string) => {
    const alreadyConnected = campaign.areas
      .find((area) => area.id === firstId)
      ?.neighborIds.includes(secondId);
    updateAreas(
      campaign.areas.map((area) => {
        if (area.id !== firstId && area.id !== secondId) return area;
        const otherId = area.id === firstId ? secondId : firstId;
        return {
          ...area,
          neighborIds: alreadyConnected
            ? area.neighborIds.filter((id) => id !== otherId)
            : [...area.neighborIds, otherId],
        };
      }),
    );
  };

  const handleAreaClick = (areaId: string) => {
    if (tool !== "connect") {
      setSelectedAreaId(areaId);
      setTool("select");
      return;
    }
    if (!connectFromId) {
      setConnectFromId(areaId);
      return;
    }
    if (connectFromId !== areaId) toggleConnection(connectFromId, areaId);
    setConnectFromId("");
  };

  const deleteSelectedArea = () => {
    if (!selectedArea) return;
    if (!window.confirm(`Delete ${selectedArea.name}?`)) return;
    const areas = campaign.areas
      .filter((area) => area.id !== selectedArea.id)
      .map((area) => ({ ...area, neighborIds: area.neighborIds.filter((id) => id !== selectedArea.id) }));
    const fallbackAreaId = areas[0]?.id ?? "";
    const characters = campaign.characters.map((character) =>
      character.startAreaId === selectedArea.id
        ? { ...character, startAreaId: fallbackAreaId, areaId: fallbackAreaId }
        : character,
    );
    onChange({ ...campaign, areas, characters });
    setSelectedAreaId(fallbackAreaId);
  };

  const addCharacter = () => {
    const number = campaign.characters.length + 1;
    const character: Character = {
      id: crypto.randomUUID(),
      name: `Character ${number}`,
      portrait: asset(`portrait-${((number - 1) % 4) + 1}.svg`),
      startAreaId: campaign.areas[0]?.id ?? "",
      areaId: campaign.areas[0]?.id ?? "",
      status: "active",
    };
    onChange({ ...campaign, characters: [...campaign.characters, character] });
  };

  const updateCharacter = (characterId: string, patch: Partial<Character>) => {
    onChange({
      ...campaign,
      characters: campaign.characters.map((character) =>
        character.id === characterId ? { ...character, ...patch } : character,
      ),
    });
  };

  const uploadPortrait = async (characterId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const portrait = await readImageFile(file);
      setImageError("");
      updateCharacter(characterId, { portrait });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The image could not be loaded.");
    } finally {
      event.target.value = "";
    }
  };

  const removeCharacter = (characterId: string) => {
    const character = campaign.characters.find((candidate) => candidate.id === characterId);
    if (!character || !window.confirm(`Remove ${character.name}?`)) return;
    onChange({ ...campaign, characters: campaign.characters.filter((candidate) => candidate.id !== characterId) });
  };

  const setupCharacters = campaign.characters.map((character) => ({
    ...character,
    areaId: character.startAreaId,
    status: "active" as const,
  }));
  const connectedAreaCount = campaign.areas.filter((area) => area.neighborIds.length > 0).length;
  const canStart = campaign.areas.length >= 2
    && connectedAreaCount === campaign.areas.length
    && campaign.characters.length >= 2
    && campaign.characters.every((character) => character.name.trim() && character.startAreaId)
    && entries.length >= 8;

  return (
    <main className="app-shell setup-screen">
      <header className="hero">
        <div>
          <p className="eyebrow">Local campaign setup</p>
          <h1>Build the arena</h1>
          <p className="hero-copy">Upload your images here. They remain saved only in this browser on this device.</p>
        </div>
        <div className="save-pill"><span className="save-dot" /> Auto-saved locally</div>
      </header>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">01</span><h2>Campaign and map</h2></div>
          <label className="upload-button">
            Replace map
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleMapUpload} />
          </label>
        </div>
        <label className="field campaign-name">
          <span>Campaign name</span>
          <input value={campaign.name} onChange={(event) => onChange({ ...campaign, name: event.target.value })} />
        </label>
        {imageError && <p className="error-message" role="alert">{imageError}</p>}
      </section>

      <section className="panel setup-section map-editor-section">
        <div className="section-heading map-tools-heading">
          <div><span className="step-number">02</span><h2>Place cells and nearby routes</h2></div>
          <div className="segmented-control" aria-label="Map editing tool">
            <button className={tool === "select" ? "is-active" : ""} onClick={() => { setTool("select"); setConnectFromId(""); }}>Select</button>
            <button className={tool === "place" ? "is-active" : ""} onClick={() => { setTool("place"); setConnectFromId(""); }}>Place circle</button>
            <button className={tool === "connect" ? "is-active" : ""} onClick={() => setTool("connect")}>Connect nearby</button>
          </div>
        </div>
        <p className="helper-text">
          {tool === "place" && "Tap the map where the new circular cell should go."}
          {tool === "connect" && (connectFromId ? "Now choose the second cell. Selecting an existing route removes it." : "Choose two nearby cells to add or remove an allowed movement route.")}
          {tool === "select" && "Select a circle to rename, resize, or delete it. Lines show allowed movement routes."}
        </p>
        <MapBoard
          mapImage={campaign.mapImage}
          areas={campaign.areas}
          characters={setupCharacters}
          mode={tool}
          selectedAreaId={selectedAreaId}
          connectFromId={connectFromId}
          onPlace={addArea}
          onAreaClick={handleAreaClick}
        />
        {selectedArea && (
          <div className="area-inspector">
            <label className="field">
              <span>Selected cell name</span>
              <input value={selectedArea.name} onChange={(event) => updateArea(selectedArea.id, { name: event.target.value })} />
            </label>
            <label className="field range-field">
              <span>Circle size</span>
              <input
                type="range"
                min="0.035"
                max="0.09"
                step="0.005"
                value={selectedArea.radius}
                onChange={(event) => updateArea(selectedArea.id, { radius: Number(event.target.value) })}
              />
            </label>
            <button className="danger-button" onClick={deleteSelectedArea}>Delete cell</button>
          </div>
        )}
      </section>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">03</span><h2>Characters</h2></div>
          <button className="secondary-button" onClick={addCharacter}>Add character</button>
        </div>
        <div className="character-grid">
          {campaign.characters.map((character) => (
            <article className="character-card" key={character.id}>
              <div className="portrait-wrap"><img src={character.portrait} alt={`${character.name} portrait`} /></div>
              <div className="character-fields">
                <label className="field"><span>Name</span><input value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} /></label>
                <label className="field">
                  <span>Starting cell</span>
                  <select value={character.startAreaId} onChange={(event) => updateCharacter(character.id, { startAreaId: event.target.value, areaId: event.target.value })}>
                    <option value="">Choose a cell</option>
                    {campaign.areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
                  </select>
                </label>
                <div className="character-actions">
                  <label className="text-button">Upload portrait<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPortrait(character.id, event)} /></label>
                  <button className="text-button danger-text" onClick={() => removeCharacter(character.id)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">04</span><h2>Story words and phrases</h2></div>
          <div className="section-actions">
            <span className={`entry-count${entries.length < 8 ? " is-low" : ""}`}>{entries.length} entries</span>
            <label className="upload-button">Upload .txt<input type="file" accept=".txt,text/plain" onChange={(event) => void handleTextUpload(event)} /></label>
          </div>
        </div>
        <p className="helper-text">Paste below or upload a text file. Separate each word or phrase with a semicolon. Conflict text uses up to 12, with a minimum requirement of 8.</p>
        {textFileError && <p className="error-message" role="alert">{textFileError}</p>}
        <textarea
          className="phrase-input"
          value={campaign.phraseSource}
          onChange={(event) => onChange({ ...campaign, phraseSource: event.target.value })}
          rows={6}
          spellCheck="true"
        />
      </section>

      <section className="launch-panel">
        <div>
          <p className="eyebrow">Movement rule</p>
          <h2>50% stay, 50% move to a connected cell</h2>
          {!canStart && <p className="validation-message">To start: add at least 2 characters, 2 cells, a route for every cell, starting positions, and 8 text entries.</p>}
        </div>
        <button className="primary-button launch-button" disabled={!canStart} onClick={onStart}>Start battle</button>
      </section>

      <button className="reset-link" onClick={onReset}>Restore all placeholder content</button>
    </main>
  );
}
