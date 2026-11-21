import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { readImageFile } from "../imageFiles";
import { buildSetupPrompt, parseEntries } from "../game";
import {
  deleteMap,
  exportBackup,
  importBackup,
  importMap,
  isAttireFile,
  isBackupFile,
  isMapFile,
  listMaps,
  saveMap,
} from "../storage";
import { activeAttire, createAttire, withActiveAttire } from "../data";
import { useLongPress } from "../useLongPress";
import type {
  Area,
  Attire,
  Campaign,
  Character,
  Crate,
  DangerPoint,
  HealingPoint,
  LootPreset,
  MapWeapon,
  SavedMap,
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
  onImport: (campaign: Campaign) => void;
};

type EditTool = "select" | "place" | "connect";
type PlacementKind = "weapon" | "crate" | "heal" | "danger";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
const blankPortrait = () => asset("portrait-1.svg");

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

// Download any JSON-serializable object as a file. Shared by backup and the
// per-map / per-attire exporters.
const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const slug = (text: string): string =>
  text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled";

// Spread `count` items across the given cells, one per cell while cells remain,
// then OVER-PLACE the remainder by stacking into repeated cells. Returns the
// chosen areaId for each of the `count` items. Cells are shuffled so repeated
// calls do not always favor the same cells.
const spreadAcrossCells = (count: number, areaIds: string[]): string[] => {
  if (areaIds.length === 0) return [];
  const shuffled = [...areaIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
};

// A press-and-hold button: tap cycles, long-press (~500ms) creates. Used for
// both "Switch attire" and "Switch loot preset" so the interaction matches.
function LongPressButton({
  className,
  label,
  onCycle,
  onCreate,
  disabled,
}: {
  className?: string;
  label: string;
  onCycle: () => void;
  onCreate: () => void;
  disabled?: boolean;
}) {
  const handlers = useLongPress(onCycle, onCreate);
  return (
    <button className={className} type="button" disabled={disabled} {...handlers}>
      {label}
    </button>
  );
}

export default function SetupScreen({ campaign, onChange, onStart, onReset, onOpenSettings, onImport }: SetupScreenProps) {
  const [tool, setTool] = useState<EditTool>("select");
  const [placementKind, setPlacementKind] = useState<PlacementKind>("weapon");
  const [placementWeapon, setPlacementWeapon] = useState<WeaponType>("shotgun");
  const [selectedAreaId, setSelectedAreaId] = useState(campaign.areas[0]?.id ?? "");
  const [connectFromId, setConnectFromId] = useState("");
  const [imageError, setImageError] = useState("");
  const [textFileError, setTextFileError] = useState("");
  const [maps, setMaps] = useState<SavedMap[]>([]);
  const [mapError, setMapError] = useState("");
  const [mapStatus, setMapStatus] = useState("");
  const [backupError, setBackupError] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  // Per-type counts for the "Add random" menu.
  const [randomCounts, setRandomCounts] = useState({ weapons: 4, crates: 2, heal: 2, danger: 2 });
  const entries = useMemo(() => parseEntries(campaign.phraseSource), [campaign.phraseSource]);
  const setupPrompt = useMemo(() => buildSetupPrompt(campaign), [campaign]);
  const selectedArea = campaign.areas.find((area) => area.id === selectedAreaId);
  const settings = campaign.settings;

  const refreshMaps = () => {
    void listMaps()
      .then(setMaps)
      .catch(() => setMapError("The map library is unavailable in this browser session."));
  };

  useEffect(() => {
    refreshMaps();
  }, []);

  // Download the whole backup (current campaign + layouts + map library +
  // roster) as a single JSON file the user can keep or move to another device.
  const handleExportBackup = async () => {
    setBackupError("");
    setBackupStatus("");
    try {
      const backup = await exportBackup();
      downloadJson(backup, `battle-royale-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setBackupStatus("Backup downloaded.");
    } catch {
      setBackupError("Could not export the backup.");
    }
  };

  // Import a backup file. Replaces the current campaign and MERGES its layouts,
  // maps, and roster, after a confirmation since it overwrites the campaign.
  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupError("");
    setBackupStatus("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isBackupFile(parsed)) {
        setBackupError("That file is not a Battle Royale backup.");
        return;
      }
      if (!window.confirm("Import this backup? It replaces your current campaign and merges its maps, roster, and layouts.")) return;
      const imported = await importBackup(parsed);
      onImport(imported);
      refreshMaps();
      setBackupStatus("Backup imported.");
    } catch {
      setBackupError("Could not read that backup file.");
    }
  };

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
    const portrait = asset(`portrait-${((number - 1) % 4) + 1}.svg`);
    const attire = createAttire(portrait, "");
    const character: Character = {
      id: crypto.randomUUID(),
      name: `Character ${number}`,
      portrait,
      attires: [attire],
      activeAttireId: attire.id,
      sitOut: false,
      startAreaId: campaign.areas[0]?.id ?? "",
      areaId: campaign.areas[0]?.id ?? "",
      status: "active",
      power: settings.startingPower,
      invulnerable: false,
    };
    onChange({ ...campaign, characters: [...campaign.characters, character] });
  };

  // Apply a patch to one character. A `portrait` change is mirrored onto the
  // active attire's picture; any mutation routes through withActiveAttire so
  // the derived `portrait` compat field stays in sync with the active attire.
  const updateCharacter = (characterId: string, patch: Partial<Character>) => {
    onChange({
      ...campaign,
      characters: campaign.characters.map((character) => {
        if (character.id !== characterId) return character;
        const next = { ...character, ...patch };
        if (patch.portrait !== undefined) {
          next.attires = next.attires.map((attire) =>
            attire.id === next.activeAttireId ? { ...attire, picture: patch.portrait as string } : attire,
          );
        }
        return withActiveAttire(next);
      }),
    });
  };

  // Replace a character wholesale (used by the attire helpers which already
  // produce a fully-formed character with portrait synced).
  const replaceCharacter = (characterId: string, next: Character) => {
    onChange({
      ...campaign,
      characters: campaign.characters.map((character) => (character.id === characterId ? next : character)),
    });
  };

  // --- Attire cycling -------------------------------------------------------
  const cycleAttire = (character: Character) => {
    if (character.attires.length < 2) return;
    const index = character.attires.findIndex((attire) => attire.id === character.activeAttireId);
    const nextAttire = character.attires[(index + 1) % character.attires.length];
    replaceCharacter(character.id, withActiveAttire({ ...character, activeAttireId: nextAttire.id }));
  };

  // Long-press "Switch attire": add a NEW blank attire (empty text, placeholder
  // picture) and make it active.
  const addAttire = (character: Character) => {
    const attire = createAttire(blankPortrait(), "");
    replaceCharacter(
      character.id,
      withActiveAttire({ ...character, attires: [...character.attires, attire], activeAttireId: attire.id }),
    );
  };

  const updateActiveAttireText = (character: Character, text: string) => {
    const attires = character.attires.map((attire) =>
      attire.id === character.activeAttireId ? { ...attire, text } : attire,
    );
    replaceCharacter(character.id, withActiveAttire({ ...character, attires }));
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

  // Paste a portrait from the clipboard. Falls back to a clear message if the
  // browser cannot read clipboard images (e.g. Safari/iOS) so the user can use
  // Upload portrait instead. Writes to the active attire via updateCharacter.
  const pastePortrait = async (characterId: string) => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
        throw new Error("Clipboard paste is not supported here. Use Upload portrait instead.");
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const portrait = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("The clipboard image could not be read."));
          reader.readAsDataURL(blob);
        });
        setImageError("");
        updateCharacter(characterId, { portrait });
        return;
      }
      setImageError("No image found on the clipboard.");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The clipboard image could not be read. Use Upload portrait instead.");
    }
  };

  const removeCharacter = (characterId: string) => {
    const character = campaign.characters.find((candidate) => candidate.id === characterId);
    if (!character || !window.confirm(`Remove ${character.name}?`)) return;
    onChange({ ...campaign, characters: campaign.characters.filter((candidate) => candidate.id !== characterId) });
  };

  // --- Per-attire export / import ------------------------------------------
  const exportAttire = (character: Character) => {
    const attire = activeAttire(character);
    if (!attire) return;
    downloadJson(
      { format: "battle-royale-attire", version: 1, attire },
      `attire-${slug(character.name)}.json`,
    );
  };

  const importAttireFor = async (characterId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAttireFile(parsed)) {
        setImageError("That file is not a Battle Royale attire.");
        return;
      }
      const character = campaign.characters.find((candidate) => candidate.id === characterId);
      if (!character) return;
      // Add as a NEW attire (fresh id) made active.
      const attire: Attire = { ...parsed.attire, id: crypto.randomUUID() };
      setImageError("");
      replaceCharacter(
        character.id,
        withActiveAttire({ ...character, attires: [...character.attires, attire], activeAttireId: attire.id }),
      );
    } catch {
      setImageError("Could not read that attire file.");
    }
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

  // --- Random menu (ADD semantics) -----------------------------------------
  // Add scatters the requested count of EACH type, placing same-type items in
  // separate cells where possible and over-placing (stacking) the remainder
  // when the count exceeds the number of cells. Different types may share a
  // cell. Items are APPENDED to what is already placed.
  const addRandomItems = () => {
    if (campaign.areas.length === 0) return;
    const areaIds = campaign.areas.map((area) => area.id);
    const weaponCells = spreadAcrossCells(Math.max(0, randomCounts.weapons), areaIds);
    const crateCells = spreadAcrossCells(Math.max(0, randomCounts.crates), areaIds);
    const healCells = spreadAcrossCells(Math.max(0, randomCounts.heal), areaIds);
    const dangerCells = spreadAcrossCells(Math.max(0, randomCounts.danger), areaIds);

    const weapons: MapWeapon[] = weaponCells.map((areaId) => ({
      id: crypto.randomUUID(),
      areaId,
      weapon: randomWeapon(),
    }));
    const crates: Crate[] = crateCells.map((areaId) => ({
      id: crypto.randomUUID(),
      areaId,
      weapon: randomWeapon(),
      opened: false,
    }));
    let healNumber = nextPointNumber(campaign.healingPoints, "Healing Point");
    const healingPoints: HealingPoint[] = healCells.map((areaId) => ({
      id: crypto.randomUUID(),
      areaId,
      name: `Healing Point ${healNumber++}`,
      healAmount: settings.healAmount,
      chance: settings.healChance,
      cooldownRounds: settings.healCooldownRounds,
      cooldownRemaining: 0,
    }));
    let dangerNumber = nextPointNumber(campaign.dangerPoints, "Danger Point");
    const dangerPoints: DangerPoint[] = dangerCells.map((areaId) => ({
      id: crypto.randomUUID(),
      areaId,
      name: `Danger Point ${dangerNumber++}`,
      minDamage: settings.dangerMinDamage,
      maxDamage: settings.dangerMaxDamage,
      avoidChance: settings.dangerAvoidChance,
    }));

    onChange({
      ...campaign,
      weapons: [...campaign.weapons, ...weapons],
      crates: [...campaign.crates, ...crates],
      healingPoints: [...campaign.healingPoints, ...healingPoints],
      dangerPoints: [...campaign.dangerPoints, ...dangerPoints],
    });
  };

  const clearItems = () => {
    if (!window.confirm("Remove every placed weapon, crate, healing point, and danger point?")) return;
    onChange({ ...campaign, weapons: [], crates: [], healingPoints: [], dangerPoints: [] });
  };

  // Spread the PARTICIPATING (non-sit-out) characters across separate cells,
  // over-placing when there are more characters than cells. Sets both
  // startAreaId and areaId so the setup preview and the game start match.
  const randomizePositions = () => {
    if (campaign.areas.length === 0) return;
    const areaIds = campaign.areas.map((area) => area.id);
    const participating = campaign.characters.filter((character) => !character.sitOut);
    const cells = spreadAcrossCells(participating.length, areaIds);
    let cellIndex = 0;
    const characters = campaign.characters.map((character) => {
      if (character.sitOut) return character;
      const areaId = cells[cellIndex++] ?? character.startAreaId;
      return { ...character, startAreaId: areaId, areaId };
    });
    onChange({ ...campaign, characters });
  };

  // --- Map library ----------------------------------------------------------
  // Save the live board (image, areas/connections, and the active loot as the
  // active preset) back into the active SavedMap, or create a new library entry
  // when no map is active yet.
  const liveLootPreset = (presetId: string, name?: string): LootPreset => ({
    id: presetId,
    name,
    weapons: campaign.weapons,
    crates: campaign.crates,
    healingPoints: campaign.healingPoints,
    dangerPoints: campaign.dangerPoints,
  });

  const handleSaveMap = async () => {
    setMapError("");
    setMapStatus("");
    const existing = campaign.activeMapId ? maps.find((map) => map.id === campaign.activeMapId) : undefined;
    try {
      let saved: SavedMap;
      if (existing) {
        // Write the live board back, updating only the active loot preset so the
        // other presets in this map are preserved.
        const activeId = existing.activeLootPresetId;
        const presets = existing.lootPresets.map((preset) =>
          preset.id === activeId ? liveLootPreset(activeId, preset.name) : preset,
        );
        saved = {
          ...existing,
          name: campaign.name,
          savedAt: Date.now(),
          mapImage: campaign.mapImage,
          areas: campaign.areas,
          lootPresets: presets.length > 0 ? presets : [liveLootPreset(crypto.randomUUID(), "Loot 1")],
        };
      } else {
        const preset = liveLootPreset(crypto.randomUUID(), "Loot 1");
        saved = {
          id: crypto.randomUUID(),
          name: campaign.name,
          savedAt: Date.now(),
          mapImage: campaign.mapImage,
          areas: campaign.areas,
          lootPresets: [preset],
          activeLootPresetId: preset.id,
        };
      }
      await saveMap(saved);
      onChange({ ...campaign, activeMapId: saved.id });
      refreshMaps();
      setMapStatus(existing ? "Map updated in the library." : "Map saved to the library.");
    } catch {
      setMapError("The map could not be saved locally.");
    }
  };

  // Create a fresh blank map made active: a single empty cell, no loot, and a
  // clean live board. Characters, story words, and settings are untouched.
  const handleNewMap = () => {
    if (!window.confirm("Create a new blank map? This clears the current cells and placed loot in the live board (saved maps are untouched).")) return;
    const area: Area = { id: crypto.randomUUID(), name: "Area 1", x: 0.5, y: 0.5, radius: 0.055, neighborIds: [] };
    const characters = campaign.characters.map((character) => ({
      ...character,
      startAreaId: area.id,
      areaId: area.id,
    }));
    onChange({
      ...campaign,
      mapImage: asset("placeholder-map.svg"),
      areas: [area],
      characters,
      weapons: [],
      crates: [],
      healingPoints: [],
      dangerPoints: [],
      activeMapId: undefined,
    });
    setSelectedAreaId(area.id);
    setMapStatus("New blank map ready. Use Save map to add it to the library.");
  };

  // Project a saved map (its image, areas, and active loot preset) into the live
  // board and mark it active. The live weapons/crates/points become that
  // preset's contents.
  const switchToMap = (map: SavedMap) => {
    if (!window.confirm(`Switch to "${map.name}"? This replaces the current cells, connections, and placed loot in the live board.`)) return;
    const preset =
      map.lootPresets.find((candidate) => candidate.id === map.activeLootPresetId) ?? map.lootPresets[0];
    const fallbackAreaId = map.areas[0]?.id ?? "";
    const characters = campaign.characters.map((character) =>
      map.areas.some((area) => area.id === character.startAreaId)
        ? character
        : { ...character, startAreaId: fallbackAreaId, areaId: fallbackAreaId },
    );
    onChange({
      ...campaign,
      mapImage: map.mapImage,
      areas: map.areas,
      characters,
      weapons: preset?.weapons ?? [],
      crates: preset?.crates ?? [],
      healingPoints: preset?.healingPoints ?? [],
      dangerPoints: preset?.dangerPoints ?? [],
      activeMapId: map.id,
    });
    setSelectedAreaId(fallbackAreaId);
    setMapStatus(`Switched to "${map.name}".`);
  };

  const removeMap = async (map: SavedMap) => {
    if (!window.confirm(`Delete map "${map.name}" from the library?`)) return;
    try {
      await deleteMap(map.id);
      if (campaign.activeMapId === map.id) onChange({ ...campaign, activeMapId: undefined });
      refreshMaps();
    } catch {
      setMapError("The map could not be deleted.");
    }
  };

  // --- Cycleable loot presets within the active map -------------------------
  // The active map's presets, kept in the library; the live board is a working
  // copy of whichever preset is active. Cycling/creating writes the live board
  // into the current preset first so edits are not lost.
  const activeMap = campaign.activeMapId ? maps.find((map) => map.id === campaign.activeMapId) : undefined;

  // Persist the live board into the active map under `nextActivePresetId`,
  // leaving `presets` as the full preset list, then project that preset into the
  // live board. Used by both cycle and create.
  const applyPresetChange = async (map: SavedMap, presets: LootPreset[], nextActivePresetId: string) => {
    // First fold the current live board back into the currently-active preset.
    const currentId = map.activeLootPresetId;
    const foldedPresets = presets.map((preset) =>
      preset.id === currentId ? liveLootPreset(currentId, preset.name) : preset,
    );
    const target = foldedPresets.find((preset) => preset.id === nextActivePresetId);
    const saved: SavedMap = { ...map, savedAt: Date.now(), activeLootPresetId: nextActivePresetId, lootPresets: foldedPresets };
    try {
      await saveMap(saved);
      refreshMaps();
    } catch {
      setMapError("The loot preset could not be saved locally.");
    }
    onChange({
      ...campaign,
      weapons: target?.weapons ?? [],
      crates: target?.crates ?? [],
      healingPoints: target?.healingPoints ?? [],
      dangerPoints: target?.dangerPoints ?? [],
    });
  };

  const cycleLootPreset = () => {
    if (!activeMap || activeMap.lootPresets.length < 2) return;
    const index = activeMap.lootPresets.findIndex((preset) => preset.id === activeMap.activeLootPresetId);
    const nextPreset = activeMap.lootPresets[(index + 1) % activeMap.lootPresets.length];
    void applyPresetChange(activeMap, activeMap.lootPresets, nextPreset.id);
    setMapStatus(`Loot preset: ${nextPreset.name ?? "Unnamed"}.`);
  };

  const addLootPreset = () => {
    if (!activeMap) return;
    const blank: LootPreset = {
      id: crypto.randomUUID(),
      name: `Loot ${activeMap.lootPresets.length + 1}`,
      weapons: [],
      crates: [],
      healingPoints: [],
      dangerPoints: [],
    };
    void applyPresetChange(activeMap, [...activeMap.lootPresets, blank], blank.id);
    setMapStatus(`New blank loot preset: ${blank.name}.`);
  };

  // --- Per-map export / import ----------------------------------------------
  const exportMap = (map: SavedMap) => {
    downloadJson({ format: "battle-royale-map", version: 1, map }, `map-${slug(map.name)}.json`);
  };

  const handleImportMap = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMapError("");
    setMapStatus("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isMapFile(parsed)) {
        setMapError("That file is not a Battle Royale map.");
        return;
      }
      await importMap(parsed);
      refreshMaps();
      setMapStatus("Map imported into the library.");
    } catch {
      setMapError("Could not read that map file.");
    }
  };

  const setupCharacters = campaign.characters
    .filter((character) => !character.sitOut)
    .map((character) => ({
      ...character,
      areaId: character.startAreaId,
      status: "active" as const,
    }));
  const connectedAreaCount = campaign.areas.filter((area) => area.neighborIds.length > 0).length;
  const participatingCount = campaign.characters.filter((character) => !character.sitOut).length;
  const canStart = campaign.areas.length >= 2
    && connectedAreaCount === campaign.areas.length
    && participatingCount >= 2
    && campaign.characters.every((character) => character.sitOut || (character.name.trim() && character.startAreaId))
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
          <div><span className="step-number">03</span><h2>Characters and attires</h2></div>
          <button className="secondary-button" onClick={addCharacter}>Add character</button>
        </div>
        <p className="helper-text">Switch attire cycles a character's outfits; press and hold it to add a new blank attire. The attire text is announced at the start of the game (round 0). Upload or paste a portrait to set the active attire's picture. Tick Sit out to keep a character in the roster but out of the next game.</p>
        <div className="character-grid">
          {campaign.characters.map((character) => {
            const attire = activeAttire(character);
            const attireIndex = character.attires.findIndex((candidate) => candidate.id === character.activeAttireId);
            return (
              <article className={`character-card${character.sitOut ? " is-sitting-out" : ""}`} key={character.id}>
                <div className="portrait-wrap"><img src={character.portrait} alt={`${character.name} portrait`} /></div>
                <div className="character-fields">
                  <label className="field"><span>Name</span><input value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} /></label>
                  <div className="attire-row">
                    <LongPressButton
                      className="secondary-button attire-switch"
                      label={`Switch attire (${attireIndex + 1}/${character.attires.length})`}
                      onCycle={() => cycleAttire(character)}
                      onCreate={() => addAttire(character)}
                    />
                    <span className="attire-hint">Hold to add new</span>
                  </div>
                  <label className="field">
                    <span>Attire text (round 0)</span>
                    <input
                      value={attire?.text ?? ""}
                      placeholder="e.g. a tattered crimson cloak"
                      onChange={(event) => updateActiveAttireText(character, event.target.value)}
                    />
                  </label>
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
                    <label className="invulnerable-toggle sit-out-toggle">
                      <input
                        type="checkbox"
                        checked={character.sitOut}
                        onChange={(event) => updateCharacter(character.id, { sitOut: event.target.checked })}
                      />
                      Sit out
                    </label>
                  </div>
                  <div className="character-actions">
                    <label className="text-button">Upload portrait<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPortrait(character.id, event)} /></label>
                    <button className="text-button" onClick={() => void pastePortrait(character.id)}>Paste</button>
                    <button className="text-button" onClick={() => exportAttire(character)}>Export attire</button>
                    <label className="text-button">Import attire<input type="file" accept="application/json,.json" onChange={(event) => void importAttireFor(character.id, event)} /></label>
                    <button className="text-button danger-text" onClick={() => removeCharacter(character.id)}>Remove</button>
                  </div>
                </div>
              </article>
            );
          })}
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

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">05</span><h2>Weapons, crates, and points</h2></div>
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

        <div className="random-menu">
          <h3>Add random loot</h3>
          <p className="helper-text">Adds (appends) the chosen number of each type, placing same-type items in separate cells where possible and stacking the rest when a count is larger than the number of cells. Different types may share a cell.</p>
          <div className="random-menu-grid">
            <NumberField label="Weapons" value={randomCounts.weapons} min={0} onChange={(value) => setRandomCounts((prev) => ({ ...prev, weapons: value }))} />
            <NumberField label="Crates" value={randomCounts.crates} min={0} onChange={(value) => setRandomCounts((prev) => ({ ...prev, crates: value }))} />
            <NumberField label="Healing points" value={randomCounts.heal} min={0} onChange={(value) => setRandomCounts((prev) => ({ ...prev, heal: value }))} />
            <NumberField label="Danger points" value={randomCounts.danger} min={0} onChange={(value) => setRandomCounts((prev) => ({ ...prev, danger: value }))} />
          </div>
          <div className="random-menu-actions">
            <button className="secondary-button" disabled={campaign.areas.length === 0} onClick={addRandomItems}>Add random</button>
            <button className="secondary-button" disabled={campaign.areas.length === 0} onClick={randomizePositions}>Randomize character positions</button>
            {totalItems > 0 && <button className="text-button danger-text" onClick={clearItems}>Clear all placed items</button>}
          </div>
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
          <div><span className="step-number">06</span><h2>Map library</h2></div>
          <div className="section-actions">
            <button className="secondary-button" onClick={() => void handleSaveMap()}>Save map</button>
            <button className="secondary-button" onClick={handleNewMap}>New map</button>
            <label className="upload-button">Import map<input type="file" accept="application/json,.json" onChange={(event) => void handleImportMap(event)} /></label>
          </div>
        </div>
        <p className="helper-text">Save the current map, its cells and connections, and the active loot as a reusable map. Each map keeps its own cycleable loot presets. Saved maps carry across setups and are not erased by starting a new game, restoring placeholders, or importing a backup.</p>
        {mapError && <p className="error-message" role="alert">{mapError}</p>}
        {mapStatus && <p className="success-message" role="status">{mapStatus}</p>}

        {activeMap && (
          <div className="loot-switcher">
            <div className="loot-switcher-meta">
              <strong>Active map: {activeMap.name}</strong>
              <span>
                Loot preset {Math.max(1, activeMap.lootPresets.findIndex((preset) => preset.id === activeMap.activeLootPresetId) + 1)}
                {" / "}{activeMap.lootPresets.length}
                {activeMap.lootPresets.find((preset) => preset.id === activeMap.activeLootPresetId)?.name
                  ? ` · ${activeMap.lootPresets.find((preset) => preset.id === activeMap.activeLootPresetId)?.name}`
                  : ""}
              </span>
            </div>
            <LongPressButton
              className="secondary-button"
              label="Switch loot preset"
              onCycle={cycleLootPreset}
              onCreate={addLootPreset}
              disabled={activeMap.lootPresets.length < 1}
            />
            <span className="attire-hint">Hold to add a blank preset</span>
          </div>
        )}

        {maps.length === 0 ? (
          <p className="helper-text">No saved maps yet. Use Save map to add the current board.</p>
        ) : (
          <div className="layout-list">
            {maps.map((map) => (
              <div className={`layout-row${map.id === campaign.activeMapId ? " is-active-map" : ""}`} key={map.id}>
                <div className="layout-meta">
                  <strong>{map.name}{map.id === campaign.activeMapId ? " (active)" : ""}</strong>
                  <span>{map.areas.length} cells · {map.lootPresets.length} loot preset{map.lootPresets.length === 1 ? "" : "s"} · {new Date(map.savedAt).toLocaleString()}</span>
                </div>
                <div className="layout-actions">
                  <button className="secondary-button" onClick={() => switchToMap(map)}>Switch to</button>
                  <button className="text-button" onClick={() => exportMap(map)}>Export</button>
                  <button className="text-button danger-text" onClick={() => void removeMap(map)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">07</span><h2>Backup and restore</h2></div>
        </div>
        <p className="helper-text">Everything is stored only in this browser. Export a whole-gamestate backup (campaign, map library, and roster) to keep it safe or move it to another device; importing replaces your current campaign and merges its maps and roster. Per-map and per-attire export/import live on the map library and character cards above.</p>
        {backupError && <p className="error-message" role="alert">{backupError}</p>}
        {backupStatus && <p className="success-message" role="status">{backupStatus}</p>}
        <div className="backup-actions">
          <button className="secondary-button" onClick={() => void handleExportBackup()}>Export backup</button>
          <label className="upload-button">Import backup<input type="file" accept="application/json,.json" onChange={(event) => void handleImportBackup(event)} /></label>
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading">
          <div><span className="step-number">08</span><h2>World description for an AI</h2></div>
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
          {!canStart && <p className="validation-message">To start: add at least 2 participating characters, 2 cells, a route for every cell, starting positions, and 8 text entries.</p>}
        </div>
        <button className="primary-button launch-button" disabled={!canStart} onClick={onStart}>Start battle</button>
      </section>

      {/* Start is also available at the top of the page in the header. */}

      <button className="reset-link" onClick={onReset}>Restore all placeholder content</button>
    </main>
  );
}
