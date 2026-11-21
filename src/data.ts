import type {
  Attire,
  Campaign,
  Character,
  Crate,
  DangerPoint,
  GameState,
  HealingPoint,
  LootPreset,
  MapWeapon,
  SavedMap,
  Settings,
  WeaponType,
} from "./types";

import { weaponSlot } from "./weapons";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

export const defaultSettings = (): Settings => ({
  stayChance: 0.5,
  powerChangeMin: -2,
  powerChangeMax: 2,
  startingPower: 7,
  sniperHitChance: 0.1,
  sniperFlatDamage: 3,
  sniperInstantKillChance: 0.5,
  weaponBonuses: {
    shotgun: 4,
    "suppressed-pistol": 2,
    knife: 1,
    sniper: 0,
  },
  crateFindChance: 0.5,
  healAmount: 3,
  healChance: 0.5,
  healCooldownRounds: 3,
  dangerMinDamage: 1,
  dangerMaxDamage: 4,
  deathChanceBase: 0.5,
  deathChancePerPower: 0.05,
  deathChanceLowPowerBonus: 0.1,
  winnerDamageCapPct: 0.5,
  escapePowerMin: 1,
  escapePowerMax: 2,
  dangerAvoidChance: 0.25,
});

export const emptyGameState = (): GameState => ({
  round: 0,
  phase: "ready",
  pendingOutcomes: [],
  pendingSniperShots: [],
  pendingPickups: [],
  pendingHealEvents: [],
  pendingDangerEvents: [],
  currentBasicText: "",
  currentConflictText: "",
  history: [],
});

// Build a new attire from a profile picture and an optional announcement text.
export const createAttire = (picture: string, text = ""): Attire => ({
  id: crypto.randomUUID(),
  picture,
  text,
});

// The active attire for a character, if its id still resolves.
export const activeAttire = (character: Character): Attire | undefined =>
  character.attires.find((attire) => attire.id === character.activeAttireId);

// Resolve the picture a character should render with: the active attire's
// picture, falling back to the derived `portrait` compat field.
export const characterPortrait = (character: Character): string =>
  activeAttire(character)?.picture ?? character.portrait;

// Return a copy of the character whose derived `portrait` is synced to the
// active attire. Call after any attire mutation so the compat field stays
// correct for MapBoard/roster/CellViewer.
export const withActiveAttire = (character: Character): Character => {
  const picture = activeAttire(character)?.picture ?? character.portrait;
  return picture === character.portrait ? character : { ...character, portrait: picture };
};

const defaultCharacter = (
  id: string,
  name: string,
  portraitNumber: number,
  startAreaId: string,
): Character => {
  const portrait = asset(`portrait-${portraitNumber}.svg`);
  const attire = createAttire(portrait, "");
  return {
    id,
    name,
    portrait,
    attires: [attire],
    activeAttireId: attire.id,
    sitOut: false,
    startAreaId,
    areaId: startAreaId,
    status: "active",
    power: 7,
    invulnerable: false,
  };
};

// Build a SavedMap from a campaign's live board + loot, as a single preset.
// Used to seed the map library from the default campaign (see App seeding).
export const createDefaultSavedMap = (
  campaign: Pick<
    Campaign,
    "name" | "mapImage" | "areas" | "weapons" | "crates" | "healingPoints" | "dangerPoints"
  >,
  id: string,
): SavedMap => {
  const preset: LootPreset = {
    id: crypto.randomUUID(),
    name: "Default loot",
    weapons: campaign.weapons,
    crates: campaign.crates,
    healingPoints: campaign.healingPoints,
    dangerPoints: campaign.dangerPoints,
  };
  return {
    id,
    name: campaign.name,
    savedAt: Date.now(),
    mapImage: campaign.mapImage,
    areas: campaign.areas,
    lootPresets: [preset],
    activeLootPresetId: preset.id,
  };
};

export const createDefaultCampaign = (): Campaign => ({
  version: 5,
  name: "The Shattered Reach",
  mapImage: asset("placeholder-map.svg"),
  areas: [
    { id: "port", name: "Ember Port", x: 0.16, y: 0.73, radius: 0.052, neighborIds: ["oldwood", "marsh"] },
    { id: "oldwood", name: "Oldwood", x: 0.28, y: 0.49, radius: 0.052, neighborIds: ["port", "peaks", "marsh"] },
    { id: "peaks", name: "Crown Peaks", x: 0.5, y: 0.35, radius: 0.052, neighborIds: ["oldwood", "keep", "grove"] },
    { id: "keep", name: "Iron Keep", x: 0.72, y: 0.48, radius: 0.052, neighborIds: ["peaks", "watch", "grove"] },
    { id: "watch", name: "Watchtower", x: 0.82, y: 0.67, radius: 0.052, neighborIds: ["keep", "grove"] },
    { id: "grove", name: "Thorn Grove", x: 0.56, y: 0.72, radius: 0.052, neighborIds: ["peaks", "keep", "watch", "marsh"] },
    { id: "marsh", name: "Grey Marsh", x: 0.3, y: 0.76, radius: 0.052, neighborIds: ["port", "oldwood", "grove"] },
  ],
  characters: [
    defaultCharacter("mara", "Mara Vex", 1, "port"),
    defaultCharacter("orin", "Orin Ash", 2, "keep"),
    defaultCharacter("sable", "Sable Thorn", 3, "oldwood"),
    defaultCharacter("lyra", "Lyra Vale", 4, "watch"),
  ],
  phraseSource: "fog; broken sword; betrayal; silent footsteps; red moon; hidden passage; ancient debt; sudden storm; burning banner; whispered warning; lost crown; poisoned river; unexpected ally; distant bells; final oath; shattered shield",
  stayChance: 0.5,
  weapons: [],
  crates: [],
  healingPoints: [],
  dangerPoints: [],
  settings: defaultSettings(),
  screen: "setup",
  game: emptyGameState(),
  // Stable id for the seeded default map. App reuses this when seeding the maps
  // store so the default campaign's live board has a matching SavedMap.
  activeMapId: crypto.randomUUID(),
});

type StoredCharacter = Partial<Omit<Character, "status" | "attires">> & {
  status?: string;
  attires?: unknown;
};
type StoredDangerPoint = Partial<DangerPoint>;
type StoredCampaign = Partial<Omit<Campaign, "characters" | "version" | "dangerPoints">> & {
  version?: number;
  characters?: StoredCharacter[];
  dangerPoints?: StoredDangerPoint[];
};

// Narrow an unknown stored attires value to a well-formed Attire[]. A valid
// attire has a string id and a string picture; text defaults to "".
const asAttireArray = (value: unknown): Attire[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const attires: Attire[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return undefined;
    const attire = entry as Partial<Attire>;
    if (typeof attire.id !== "string" || typeof attire.picture !== "string") return undefined;
    attires.push({
      id: attire.id,
      name: typeof attire.name === "string" ? attire.name : undefined,
      picture: attire.picture,
      text: typeof attire.text === "string" ? attire.text : "",
    });
  }
  return attires;
};

const WEAPON_TYPES: WeaponType[] = ["suppressed-pistol", "sniper", "knife", "shotgun"];

const asWeaponType = (value: unknown): WeaponType | undefined =>
  typeof value === "string" && (WEAPON_TYPES as string[]).includes(value) ? (value as WeaponType) : undefined;

export const migrateCampaign = (saved: unknown): Campaign | undefined => {
  if (!saved || typeof saved !== "object") return undefined;
  const stored = saved as StoredCampaign;
  if (!stored.name || !stored.mapImage || !stored.areas || !stored.characters || !stored.phraseSource) return undefined;

  // v3, v4, and v5 share the same board shape (areas/weapons/crates/points/game),
  // so placements and in-progress battles are preserved for all three. Older
  // saves are reset to an empty board, matching the previous v2->v3 philosophy.
  const preservesBoard = stored.version === 3 || stored.version === 4 || stored.version === 5;

  const characters: Character[] = stored.characters.map((character, index) => {
    // Route the old single weapon (or any v4-shaped fields on re-migration) into
    // the combat and ranged slots. A sniper lives in the ranged slot; everything
    // else lives in the combat slot. Idempotent for already-v4 objects.
    const combatSource = asWeaponType(character.weapon);
    const rangedSource = asWeaponType(character.rangedWeapon);
    const combatWeapon = combatSource && weaponSlot(combatSource) === "ranged" ? undefined : combatSource;
    const rangedFromCombat = combatSource && weaponSlot(combatSource) === "ranged" ? combatSource : undefined;
    const rangedWeapon = rangedSource ?? rangedFromCombat;

    const basePortrait = character.portrait ?? asset(`portrait-${(index % 4) + 1}.svg`);
    // Idempotent attire handling: a well-formed attires array with a resolving
    // activeAttireId is kept as-is (re-running migrate must not duplicate it);
    // otherwise wrap the single portrait as the one and only attire.
    const existingAttires = asAttireArray(character.attires);
    const hasValidActive =
      existingAttires !== undefined &&
      typeof character.activeAttireId === "string" &&
      existingAttires.some((attire) => attire.id === character.activeAttireId);
    const attires = hasValidActive ? existingAttires! : [createAttire(basePortrait, "")];
    const activeAttireId = hasValidActive ? character.activeAttireId! : attires[0].id;
    const portrait = attires.find((attire) => attire.id === activeAttireId)?.picture ?? basePortrait;

    return {
      id: character.id ?? crypto.randomUUID(),
      name: character.name ?? `Character ${index + 1}`,
      portrait,
      attires,
      activeAttireId,
      sitOut: Boolean(character.sitOut),
      startAreaId: character.startAreaId ?? stored.areas?.[0]?.id ?? "",
      areaId: character.areaId ?? character.startAreaId ?? stored.areas?.[0]?.id ?? "",
      status: character.status === "defeated" || character.status === "dead" ? "dead" : "active",
      power: Number.isFinite(character.power) ? Number(character.power) : 7,
      invulnerable: Boolean(character.invulnerable),
      weapon: combatWeapon,
      rangedWeapon,
      lastOpponentId: character.lastOpponentId,
      deathCause: character.deathCause,
      diedInRound: character.diedInRound,
      deadBodyImage: typeof character.deadBodyImage === "string" ? character.deadBodyImage : undefined,
    };
  });

  const dangerPoints: DangerPoint[] =
    preservesBoard && Array.isArray(stored.dangerPoints)
      ? stored.dangerPoints.map((point) => ({
          id: point.id ?? crypto.randomUUID(),
          areaId: point.areaId ?? stored.areas?.[0]?.id ?? "",
          name: point.name ?? "Danger Point",
          minDamage: Number.isFinite(point.minDamage) ? Number(point.minDamage) : 1,
          maxDamage: Number.isFinite(point.maxDamage) ? Number(point.maxDamage) : 4,
          avoidChance: Number.isFinite(point.avoidChance) ? Number(point.avoidChance) : 0.25,
        }))
      : [];

  return {
    version: 5,
    name: stored.name,
    mapImage: stored.mapImage,
    areas: stored.areas,
    characters,
    phraseSource: stored.phraseSource,
    stayChance: stored.stayChance ?? 0.5,
    weapons: preservesBoard && Array.isArray(stored.weapons) ? (stored.weapons as MapWeapon[]) : [],
    crates: preservesBoard && Array.isArray(stored.crates) ? (stored.crates as Crate[]) : [],
    healingPoints: preservesBoard && Array.isArray(stored.healingPoints) ? (stored.healingPoints as HealingPoint[]) : [],
    dangerPoints,
    settings: preservesBoard && stored.settings ? { ...defaultSettings(), ...stored.settings } : defaultSettings(),
    screen: preservesBoard ? stored.screen ?? "setup" : "setup",
    game: preservesBoard && stored.game ? { ...emptyGameState(), ...stored.game } : emptyGameState(),
    // May be undefined for pre-v5 saves until the live board is saved into the
    // map library. Never cleared by migration.
    activeMapId: typeof stored.activeMapId === "string" ? stored.activeMapId : undefined,
  };
};
