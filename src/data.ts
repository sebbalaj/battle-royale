import type {
  Campaign,
  Character,
  Crate,
  DangerPoint,
  GameState,
  HealingPoint,
  MapWeapon,
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

const defaultCharacter = (
  id: string,
  name: string,
  portraitNumber: number,
  startAreaId: string,
): Character => ({
  id,
  name,
  portrait: asset(`portrait-${portraitNumber}.svg`),
  startAreaId,
  areaId: startAreaId,
  status: "active",
  power: 7,
  invulnerable: false,
});

export const createDefaultCampaign = (): Campaign => ({
  version: 4,
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
});

type StoredCharacter = Partial<Omit<Character, "status">> & { status?: string };
type StoredDangerPoint = Partial<DangerPoint>;
type StoredCampaign = Partial<Omit<Campaign, "characters" | "version" | "dangerPoints">> & {
  version?: number;
  characters?: StoredCharacter[];
  dangerPoints?: StoredDangerPoint[];
};

const WEAPON_TYPES: WeaponType[] = ["suppressed-pistol", "sniper", "knife", "shotgun"];

const asWeaponType = (value: unknown): WeaponType | undefined =>
  typeof value === "string" && (WEAPON_TYPES as string[]).includes(value) ? (value as WeaponType) : undefined;

export const migrateCampaign = (saved: unknown): Campaign | undefined => {
  if (!saved || typeof saved !== "object") return undefined;
  const stored = saved as StoredCampaign;
  if (!stored.name || !stored.mapImage || !stored.areas || !stored.characters || !stored.phraseSource) return undefined;

  // v3 and v4 share the same board shape (areas/weapons/crates/points/game), so
  // placements and in-progress battles are preserved for both. Older saves are
  // reset to an empty board, matching the previous v2->v3 philosophy.
  const preservesBoard = stored.version === 3 || stored.version === 4;

  const characters: Character[] = stored.characters.map((character, index) => {
    // Route the old single weapon (or any v4-shaped fields on re-migration) into
    // the combat and ranged slots. A sniper lives in the ranged slot; everything
    // else lives in the combat slot. Idempotent for already-v4 objects.
    const combatSource = asWeaponType(character.weapon);
    const rangedSource = asWeaponType(character.rangedWeapon);
    const combatWeapon = combatSource && weaponSlot(combatSource) === "ranged" ? undefined : combatSource;
    const rangedFromCombat = combatSource && weaponSlot(combatSource) === "ranged" ? combatSource : undefined;
    const rangedWeapon = rangedSource ?? rangedFromCombat;

    return {
      id: character.id ?? crypto.randomUUID(),
      name: character.name ?? `Character ${index + 1}`,
      portrait: character.portrait ?? asset(`portrait-${(index % 4) + 1}.svg`),
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
    version: 4,
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
  };
};
