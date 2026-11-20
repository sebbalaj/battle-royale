import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { readImageFile } from "../imageFiles";
import { buildSetupPrompt, parseEntries } from "../game";
import { deleteLayout, listLayouts, saveLayout } from "../storage";
import { emptyGameState } from "../data";
import type {
  Area,
  Campaign,
  Character,
  Crate,
  DangerPoint,
  HealingPoint,
  LayoutSlot,
  MapWeapon,
  WeaponType,
} from "../types";
import { WEAPON_NAMES, WEAPON_TYPES, weaponSlot } from "../weapons";
import CopyPanel from "./CopyPanel";
import MapBoard from "./MapBoard";
import NumberField from "./NumberField";

const COMBAT_WEAPONS = WEAPON_TYPES.filter((weapon) => weaponSlot(weapon) === "combat");
const RANGED_WEAPONS = WEAPON_TYPES.filter((weapon) => weaponSlot(weapon) === "ranged");

type SetupScreenProps = {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
  onStart: () => void;
  onReset: () => void;
  onOpenSettings: () => void;
};

type EditTool = "select" | "place" | "connect";
type PlacementKind = "weapon" | "crate" | "heal" | "danger";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

const formatSigned = (value: number): string => (value > 0 ? `+${value}` : String(value));

// Next default suffix for auto-named points. Derived from the highest existing
// "<prefix> N" number so deletions never cause a duplicate default name.
const nextPointNumber = (points: { name: string }[], prefix: string): number => {
  const pattern = new RegExp(`^${prefix} (\\d+)$`);
  const highest = points.reduce((max, point) => {
    const match = point.name.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return highest + 1;
};
const randomWeapon = (): WeaponType => WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
const randomAreaId = (areas: Area[]): string => areas[Math.floor(Math.random() * areas.length)].id;

export default function SetupScreen({ campaign, onChange, onStart, onReset, onOpenSettings }: SetupScreenProps) {
  const [tool, setTool] = useState<EditTool>("select");
  const [placementKind, setPlacementKind] = useState<PlacementKind>("weapon");
  const [placementWeapon, setPlacementWeapon] = useState<WeaponType>("shotgun");
  const [selectedAreaId, setSelectedAreaId] = useState(campaign.areas[0]?.id ?? "");
  const [connectFromId, setConnectFromId] = useState("");
  const [imageError, setImageError] = useState("");
  const [textFileError, setTextFileError] = useState("");
  const [layouts, setLayouts] = useState<LayoutSlot[]>([]);
  const [layoutName, setLayoutName] = useState("");
  const [layoutError, setLayoutError] = useState("");
  const entries = useMemo(() => parseEntries(campaign.phraseSource), [campaign.phraseSource]);
  const setupPrompt = useMemo(() => buildSetupPrompt(campaign), [campaign]);
  const selectedArea = campaign.areas.find((area) => area.id === selectedAreaId);
  const settings = campaign.settings;

  const refreshLayouts = () => {
    void listLayouts()
      .then(setLayouts)
      .catch(() => setLayoutError("Saved layouts are unavailable in this browser session."));
  };

  useEffect(() => {
    refreshLayouts();
  }, []);

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
    onChange({
      ...campaign,
      areas,
      characters,
      weapons: campaign.weapons.filter((weapon) => weapon.areaId !== selectedArea.id),
      crates: campaign.crates.filter((crate) => crate.areaId !== selectedArea.id),
      healingPoints: campaign.healingPoints.filter((point) => point.areaId !== selectedArea.id),
      dangerPoints: campaign.dangerPoints.filter((point) => point.areaId !== selectedArea.id),
    });
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
      power: settings.startingPower,
      invulnerable: false,
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

  // --- Map item placement ---------------------------------------------------
  // Default names use the highest existing numeric suffix + 1 (not array
  // length) so deleting a point and adding a new one never repeats a name.
  const makeHealingPoint = (areaId: string): HealingPoint => ({
    id: crypto.randomUUID(),
    areaId,
    name: `Healing Point ${nextPointNumber(campaign.healingPoints, "Healing Point")}`,
    healAmount: settings.healAmount,
    chance: settings.healChance,
    cooldownRounds: settings.healCooldownRounds,
    cooldownRemaining: 0,
  });

  const makeDangerPoint = (areaId: string): DangerPoint => ({
    id: crypto.randomUUID(),
    areaId,
    name: `Danger Point ${nextPointNumber(campaign.dangerPoints, "Danger Point")}`,
    minDamage: settings.dangerMinDamage,
    maxDamage: settings.dangerMaxDamage,
    avoidChance: settings.dangerAvoidChance,
  });

  const placeItem = (areaId: string) => {
    if (!areaId) return;
    if (placementKind === "weapon") {
      const weapon: MapWeapon = { id: crypto.randomUUID(), areaId, weapon: placementWeapon };
      onChange({ ...campaign, weapons: [...campaign.weapons, weapon] });
    } else if (placementKind === "crate") {
      const crate: Crate = { id: crypto.randomUUID(), areaId, weapon: randomWeapon(), opened: false };
      onChange({ ...campaign, crates: [...campaign.crates, crate] });
    } else if (placementKind === "heal") {
      onChange({ ...campaign, healingPoints: [...campaign.healingPoints, makeHealingPoint(areaId)] });
    } else {
      onChange({ ...campaign, dangerPoints: [...campaign.dangerPoints, makeDangerPoint(areaId)] });
    }
  };

  const updateHealingPoint = (id: string, patch: Partial<HealingPoint>) => {
    onChange({
      ...campaign,
      healingPoints: campaign.healingPoints.map((point) => (point.id === id ? { ...point, ...patch } : point)),
    });
  };

  const updateDangerPoint = (id: string, patch: Partial<DangerPoint>) => {
    onChange({
      ...campaign,
      dangerPoints: campaign.dangerPoints.map((point) => (point.id === id ? { ...point, ...patch } : point)),
    });
  };

  const removeWeapon = (id: string) => onChange({ ...campaign, weapons: campaign.weapons.filter((item) => item.id !== id) });
  const removeCrate = (id: string) => onChange({ ...campaign, crates: campaign.crates.filter((item) => item.id !== id) });
  const removeHealingPoint = (id: string) => onChange({ ...campaign, healingPoints: campaign.healingPoints.filter((item) => item.id !== id) });
  const removeDangerPoint = (id: string) => onChange({ ...campaign, dangerPoints: campaign.dangerPoints.filter((item) => item.id !== id) });

  const areaName = (areaId: string) => campaign.areas.find((area) => area.id === areaId)?.name ?? "Unknown cell";

  const randomizeItems = () => {
    if (campaign.areas.length === 0) return;
    if (!window.confirm("Scatter random weapons, crates, healing points, and danger points across the map? This replaces current placements.")) return;
    const cellCount = campaign.areas.length;
    const weaponCount = Math.max(1, Math.round(cellCount / 2));
    const crateCount = Math.max(1, Math.round(cellCount / 3));
    const healCount = Math.max(1, Math.round(cellCount / 4));
    const dangerCount = Math.max(1, Math.round(cellCount / 4));
    const weapons: MapWeapon[] = Array.from({ length: weaponCount }, () => ({
      id: crypto.randomUUID(),
      areaId: randomAreaId(campaign.areas),
      weapon: randomWeapon(),
    }));
    const crates: Crate[] = Array.from({ length: crateCount }, () => ({
      id: crypto.randomUUID(),
      areaId: randomAreaId(campaign.areas),
      weapon: randomWeapon(),
      opened: false,
    }));
    const healingPoints: HealingPoint[] = Array.from({ length: healCount }, (_, index) => ({
      id: crypto.randomUUID(),
      areaId: randomAreaId(campaign.areas),
      name: `Healing Point ${index + 1}`,
      healAmount: settings.healAmount,
      chance: settings.healChance,
      cooldownRounds: settings.healCooldownRounds,
      cooldownRemaining: 0,
    }));
    const dangerPoints: DangerPoint[] = Array.from({ length: dangerCount }, (_, index) => ({
      id: crypto.randomUUID(),
      areaId: randomAreaId(campaign.areas),
      name: `Danger Point ${index + 1}`,
      minDamage: settings.dangerMinDamage,
      maxDamage: settings.dangerMaxDamage,
      avoidChance: settings.dangerAvoidChance,
    }));
    onChange({ ...campaign, weapons, crates, healingPoints, dangerPoints });
  };

  // --- Layout slots ---------------------------------------------------------
  const handleSaveLayout = async () => {
    const name = layoutName.trim();
    if (!name) {
      setLayoutError("Name the layout before saving.");
      return;
    }
    const slot: LayoutSlot = {
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      data: {
        name: campaign.name,
        mapImage: campaign.mapImage,
        areas: campaign.areas,
        // Dead-body images are runtime state, not part of a reusable layout.
        characters: campaign.characters.map(({ deadBodyImage: _deadBodyImage, ...rest }) => rest),
        phraseSource: campaign.phraseSource,
        weapons: campaign.weapons,
        crates: campaign.crates,
        healingPoints: campaign.healingPoints,
        dangerPoints: campaign.dangerPoints,
      },
    };
    try {
      await saveLayout(slot);
      setLayoutName("");
      setLayoutError("");
      refreshLayouts();
    } catch {
      setLayoutError("The layout could not be saved locally.");
    }
  };

  const loadLayout = (slot: LayoutSlot) => {
    if (!window.confirm(`Load "${slot.name}"? This replaces the current map, cells, characters, and placed items. Settings are kept.`)) return;
    const { data } = slot;
    onChange({
      ...campaign,
      name: data.name,
      mapImage: data.mapImage,
      areas: data.areas,
      characters: data.characters,
      phraseSource: data.phraseSource,
      weapons: data.weapons,
      crates: data.crates,
      healingPoints: data.healingPoints,
      dangerPoints: data.dangerPoints,
      screen: "setup",
      game: emptyGameState(),
    });
    setSelectedAreaId(data.areas[0]?.id ?? "");
  };

  const removeLayout = async (slot: LayoutSlot) => {
    if (!window.confirm(`Delete layout "${slot.name}"?`)) return;
    try {
      await deleteLayout(slot.id);
      refreshLayouts();
    } catch {
      setLayoutError("The layout could not be deleted.");
    }
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

  const totalItems = campaign.weapons.length + campaign.crates.length + campaign.healingPoints.length + campaign.dangerPoints.length;

  return (
    <main className="app-shell setup-screen">
      <header className="hero">
        <div>
          <p className="eyebrow">Local campaign setup</p>
          <h1>Build the arena</h1>
          <p className="hero-copy">Upload your images here. They remain saved only in this browser on this device.</p>
        </div>
        <div className="setup-header-actions">
          <button className="secondary-button" onClick={onOpenSettings}>Settings</button>
          <button className="primary-button launch-button" disabled={!canStart} onClick={onStart}>Start battle</button>
          <div className="save-pill"><span className="save-dot" /> Auto-saved locally</div>
        </div>
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
          weapons={campaign.weapons}
          crates={campaign.crates}
          healingPoints={campaign.healingPoints}
          dangerPoints={campaign.dangerPoints}
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
                <label className="field">
                  <span>Combat weapon</span>
                  <select
                    value={character.weapon ?? ""}
                    onChange={(event) => updateCharacter(character.id, { weapon: event.target.value ? (event.target.value as WeaponType) : undefined })}
                  >
                    <option value="">None</option>
                    {COMBAT_WEAPONS.map((weapon) => <option value={weapon} key={weapon}>{WEAPON_NAMES[weapon]}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Ranged weapon</span>
                  <select
                    value={character.rangedWeapon ?? ""}
                    onChange={(event) => updateCharacter(character.id, { rangedWeapon: event.target.value ? (event.target.value as WeaponType) : undefined })}
                  >
                    <option value="">None</option>
                    {RANGED_WEAPONS.map((weapon) => <option value={weapon} key={weapon}>{WEAPON_NAMES[weapon]}</option>)}
                  </select>
                </label>
                <div className="character-rule-row">
                  <span className="starting-power">Starts at <strong>{settings.startingPower} power</strong></span>
                  <label className="invulnerable-toggle">
                    <input
                      type="checkbox"
                      checked={character.invulnerable}
                      onChange={(event) => updateCharacter(character.id, { invulnerable: event.target.checked })}
                    />
                    Invulnerable
                  </label>
                </div>
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
          <div><span className="step-number">05</span><h2>Weapons, crates, and points</h2></div>
          <button className="secondary-button" onClick={randomizeItems}>Randomize</button>
        </div>
        <p className="helper-text">Choose an item, pick a cell, and add it. Weapon power bonuses are set in Settings and stay hidden on the map.</p>
        <div className="placement-controls">
          <div className="segmented-control" aria-label="Item to place">
            <button className={placementKind === "weapon" ? "is-active" : ""} onClick={() => setPlacementKind("weapon")}>Weapon</button>
            <button className={placementKind === "crate" ? "is-active" : ""} onClick={() => setPlacementKind("crate")}>Crate</button>
            <button className={placementKind === "heal" ? "is-active" : ""} onClick={() => setPlacementKind("heal")}>Healing</button>
            <button className={placementKind === "danger" ? "is-active" : ""} onClick={() => setPlacementKind("danger")}>Danger</button>
          </div>
          <label className="field">
            <span>Cell</span>
            <select value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)}>
              {campaign.areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
            </select>
          </label>
          {placementKind === "weapon" && (
            <label className="field">
              <span>Weapon type</span>
              <select value={placementWeapon} onChange={(event) => setPlacementWeapon(event.target.value as WeaponType)}>
                {WEAPON_TYPES.map((weapon) => <option value={weapon} key={weapon}>{WEAPON_NAMES[weapon]}</option>)}
              </select>
            </label>
          )}
          <button className="primary-button" disabled={!selectedAreaId} onClick={() => placeItem(selectedAreaId)}>Add to cell</button>
        </div>

        {totalItems === 0 ? (
          <p className="helper-text">No items placed yet.</p>
        ) : (
          <div className="placed-items">
            {campaign.weapons.length > 0 && (
              <div className="placed-group">
                <h3>Ground weapons</h3>
                {campaign.weapons.map((weapon) => (
                  <div className="placed-row" key={weapon.id}>
                    <span className="placed-label">{WEAPON_NAMES[weapon.weapon]} · {areaName(weapon.areaId)}</span>
                    <button className="text-button danger-text" onClick={() => removeWeapon(weapon.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            {campaign.crates.length > 0 && (
              <div className="placed-group">
                <h3>Crates</h3>
                {campaign.crates.map((crate) => (
                  <div className="placed-row" key={crate.id}>
                    <span className="placed-label">Crate · {areaName(crate.areaId)}{crate.opened ? " (opened)" : ""}</span>
                    <button className="text-button danger-text" onClick={() => removeCrate(crate.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            {campaign.healingPoints.length > 0 && (
              <div className="placed-group">
                <h3>Healing points</h3>
                {campaign.healingPoints.map((point) => (
                  <div className="placed-config" key={point.id}>
                    <div className="placed-config-head">
                      <span className="placed-cell">{areaName(point.areaId)}</span>
                      <button className="text-button danger-text" onClick={() => removeHealingPoint(point.id)}>Delete</button>
                    </div>
                    <div className="placed-config-fields">
                      <label className="field"><span>Name</span><input value={point.name} onChange={(event) => updateHealingPoint(point.id, { name: event.target.value })} /></label>
                      <NumberField label="Heal amount" value={point.healAmount} min={0} onChange={(value) => updateHealingPoint(point.id, { healAmount: value })} />
                      <NumberField label="Chance (0–1)" value={point.chance} min={0} max={1} step={0.05} onChange={(value) => updateHealingPoint(point.id, { chance: value })} />
                      <NumberField label="Cooldown (rounds)" value={point.cooldownRounds} min={0} onChange={(value) => updateHealingPoint(point.id, { cooldownRounds: value })} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {campaign.dangerPoints.length > 0 && (
              <div className="placed-group">
                <h3>Danger points</h3>
                {campaign.dangerPoints.map((point) => (
                  <div className="placed-config" key={point.id}>
                    <div className="placed-config-head">
                      <span className="placed-cell">{areaName(point.areaId)}</span>
                      <button className="text-button danger-text" onClick={() => removeDangerPoint(point.id)}>Delete</button>
                    </div>
                    <div className="placed-config-fields">
                      <label className="field"><span>Name</span><input value={point.name} onChange={(event) => updateDangerPoint(point.id, { name: event.target.value })} /></label>
                      <NumberField label="Min damage" value={point.minDamage} min={0} onChange={(value) => updateDangerPoint(point.id, { minDamage: value })} />
                      <NumberField label="Max damage" value={point.maxDamage} min={0} onChange={(value) => updateDangerPoint(point.id, { maxDamage: value })} />
                      <NumberField label="Avoid chance (0–1)" value={point.avoidChance} min={0} max={1} step={0.05} onChange={(value) => updateDangerPoint(point.id, { avoidChance: value })} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">06</span><h2>Saved layouts</h2></div>
        </div>
        <p className="helper-text">Save the current map, cells, characters, and placed items as a named layout. Loading a layout keeps your Settings untouched.</p>
        {layoutError && <p className="error-message" role="alert">{layoutError}</p>}
        <div className="layout-save-row">
          <label className="field">
            <span>Layout name</span>
            <input value={layoutName} onChange={(event) => setLayoutName(event.target.value)} placeholder="e.g. Forest skirmish" />
          </label>
          <button className="secondary-button" onClick={() => void handleSaveLayout()}>Save current setup</button>
        </div>
        {layouts.length === 0 ? (
          <p className="helper-text">No saved layouts yet.</p>
        ) : (
          <div className="layout-list">
            {layouts.map((slot) => (
              <div className="layout-row" key={slot.id}>
                <div className="layout-meta">
                  <strong>{slot.name}</strong>
                  <span>{new Date(slot.savedAt).toLocaleString()}</span>
                </div>
                <div className="layout-actions">
                  <button className="secondary-button" onClick={() => loadLayout(slot)}>Load</button>
                  <button className="text-button danger-text" onClick={() => void removeLayout(slot)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">07</span><h2>World description for an AI</h2></div>
        </div>
        <p className="helper-text">Copy this to describe the map connections, starting locations, points, and rules to a storytelling AI.</p>
        <CopyPanel
          title="Setup prompt"
          description="Cells and connections, characters, points, crates, and a short rules summary."
          text={setupPrompt}
        />
      </section>

      <section className="launch-panel">
        <div>
          <p className="eyebrow">Round rules</p>
          <h2>
            {Math.round(settings.stayChance * 100)}% stay · nearby movement · power changes by{" "}
            {formatSigned(settings.powerChangeMin)} to {formatSigned(settings.powerChangeMax)}
          </h2>
          {!canStart && <p className="validation-message">To start: add at least 2 characters, 2 cells, a route for every cell, starting positions, and 8 text entries.</p>}
        </div>
        <button className="primary-button launch-button" disabled={!canStart} onClick={onStart}>Start battle</button>
      </section>

      {/* Start is also available at the top of the page in the header. */}

      <button className="reset-link" onClick={onReset}>Restore all placeholder content</button>
    </main>
  );
}
