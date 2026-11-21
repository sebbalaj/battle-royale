export type Screen = "setup" | "settings" | "game";
export type GamePhase = "ready" | "outcome-hidden" | "revealed";
export type CharacterStatus = "active" | "dead";
export type LoserFate = "died" | "escaped";

export type WeaponType = "suppressed-pistol" | "sniper" | "knife" | "shotgun";

export type Area = {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  neighborIds: string[];
};

// A character outfit: a profile picture plus an attire text announced at the
// start of a game (round 0). Characters may hold several and cycle between them.
export type Attire = {
  id: string;
  name?: string;
  picture: string;
  text: string;
};

export type Character = {
  id: string;
  name: string;
  // DERIVED/compat field: always mirrors the ACTIVE attire's picture. Read
  // directly by MapBoard, the GameScreen roster, and CellViewer, so it must be
  // kept in sync after any attire mutation (see withActiveAttire in data.ts).
  portrait: string;
  // Non-empty list of outfits; activeAttireId selects the one that drives
  // `portrait` and the round-0 attire announcement.
  attires: Attire[];
  activeAttireId: string;
  // When true the character does not join the next game: greyed out on setup
  // and removed once the battle starts. Carries over between setups.
  sitOut: boolean;
  startAreaId: string;
  areaId: string;
  status: CharacterStatus;
  power: number;
  invulnerable: boolean;
  // Weapon slots. `weapon` is the COMBAT slot (kept as-is for minimal churn and
  // clean migration); `rangedWeapon` is the separate RANGED slot (snipers). A
  // character may hold both at once. Combat bonus reads ONLY the combat slot.
  weapon?: WeaponType;
  rangedWeapon?: WeaponType;
  lastOpponentId?: string;
  deathCause?: string;
  diedInRound?: number;
  // Runtime-only image (data URL) shown full-screen for a fallen character.
  // Excluded from reusable layout saves (see LayoutData).
  deadBodyImage?: string;
};

export type MapWeapon = {
  id: string;
  areaId: string;
  weapon: WeaponType;
};

export type Crate = {
  id: string;
  areaId: string;
  weapon: WeaponType;
  opened: boolean;
};

export type HealingPoint = {
  id: string;
  areaId: string;
  name: string;
  healAmount: number;
  chance: number;
  cooldownRounds: number;
  cooldownRemaining: number;
};

export type DangerPoint = {
  id: string;
  areaId: string;
  name: string;
  minDamage: number;
  maxDamage: number;
  // Per-point chance (0..1) an occupant avoids all damage this round.
  avoidChance: number;
};

export type Settings = {
  stayChance: number;
  powerChangeMin: number;
  powerChangeMax: number;
  startingPower: number;
  sniperHitChance: number;
  sniperFlatDamage: number;
  sniperInstantKillChance: number;
  weaponBonuses: Record<WeaponType, number>;
  crateFindChance: number;
  healAmount: number;
  healChance: number;
  healCooldownRounds: number;
  dangerMinDamage: number;
  dangerMaxDamage: number;
  deathChanceBase: number;
  deathChancePerPower: number;
  deathChanceLowPowerBonus: number;
  winnerDamageCapPct: number;
  escapePowerMin: number;
  escapePowerMax: number;
  // Default chance (0..1) a character avoids all damage at a danger point.
  dangerAvoidChance: number;
};

export type Movement = {
  characterId: string;
  fromAreaId: string;
  toAreaId: string;
  powerBefore: number;
  powerChange: number;
  powerAfter: number;
  deathCause?: string;
};

export type FightExchange = {
  fighterIds: [string, string];
  winnerId: string;
  loserId: string;
  winnerChance: number;
  winnerPowerBefore: number;
  winnerDamage: number;
  winnerPowerAfter: number;
  loserPowerBefore: number;
  loserFate: LoserFate;
  loserDeathChance: number;
  loserPowerAfter: number;
  escapeAreaId?: string;
  // Weapons the winner takes from the loser, decided and LOCKED at Advance for
  // BOTH a died and an escaped loser (the winner auto-takes the loser's slot
  // weapon whenever it is better for that slot). Applied at Reveal: the stolen
  // weapon moves to the winner, the winner's replaced weapon (if any) drops on
  // the conflict cell, and an escaped loser no longer carries the stolen slot.
  // On a kill the loser's UNSTOLEN remaining slots drop to the ground instead.
  winnerStoleCombat?: WeaponType;
  winnerStoleRanged?: WeaponType;
};

export type ConflictOutcome = {
  areaId: string;
  participantIds: string[];
  finalControllerId: string;
  fights: FightExchange[];
};

export type SniperShot = {
  shooterId: string;
  targetId: string;
  hit: boolean;
  instantKill: boolean;
  damage: number;
  targetPowerBefore: number;
  targetPowerAfter: number;
  // Signed power delta applied against the target's LIVE power at Reveal.
  // instantKill is carried separately because it kills regardless of power.
  powerDelta: number;
  targetDies: boolean;
};

export type WeaponPickup = {
  characterId: string;
  areaId: string;
  weapon: WeaponType;
  source: "crate" | "ground" | "drop";
  replaced?: WeaponType;
  // True for a pickup rolled for an ESCAPED 1v1 loser at their destination cell
  // (item 8). These are applied at Reveal AFTER conflicts move the loser, and
  // only if the loser still occupies areaId, so a conflict result is never
  // clobbered. Normal same-round pickups (undefined) are applied before
  // conflicts as before.
  postConflict?: boolean;
};

export type HealEvent = {
  characterId: string;
  pointId: string;
  pointName: string;
  // Cell the heal was rolled against. Applied at Reveal only if the character
  // still occupies it, so a character moved by conflict is not healed remotely.
  areaId: string;
  amount: number;
  powerBefore: number;
  powerAfter: number;
};

export type DangerEvent = {
  characterId: string;
  pointId: string;
  pointName: string;
  // Cell the damage was rolled against (see HealEvent.areaId).
  areaId: string;
  damage: number;
  powerBefore: number;
  powerAfter: number;
  died: boolean;
  // Rolled and locked at Advance: when true the occupant dodged the danger and
  // no damage is applied at Reveal (powerBefore === powerAfter, died false).
  avoided: boolean;
};

export type RoundRecord = {
  round: number;
  movements: Movement[];
  conflicts: ConflictOutcome[];
  sniperShots: SniperShot[];
  pickups: WeaponPickup[];
  healEvents: HealEvent[];
  dangerEvents: DangerEvent[];
  basicText: string;
  conflictText: string;
  revealed: boolean;
};

export type GameState = {
  round: number;
  phase: GamePhase;
  pendingOutcomes: ConflictOutcome[];
  pendingSniperShots: SniperShot[];
  pendingPickups: WeaponPickup[];
  pendingHealEvents: HealEvent[];
  pendingDangerEvents: DangerEvent[];
  currentBasicText: string;
  currentConflictText: string;
  history: RoundRecord[];
};

export type LayoutData = {
  name: string;
  mapImage: string;
  areas: Area[];
  // Stores full Character objects. Dead-body images are runtime state and must
  // be stripped from characters before saving a reusable layout.
  characters: Character[];
  phraseSource: string;
  weapons: MapWeapon[];
  crates: Crate[];
  healingPoints: HealingPoint[];
  dangerPoints: DangerPoint[];
};

export type LayoutSlot = {
  id: string;
  name: string;
  savedAt: number;
  data: LayoutData;
};

// A cycleable loot configuration within a saved map: the full set of ground
// weapons, crates, healing points, and danger points for one preset. Switched
// the same way attires are, via an active id on the SavedMap.
export type LootPreset = {
  id: string;
  name?: string;
  weapons: MapWeapon[];
  crates: Crate[];
  healingPoints: HealingPoint[];
  dangerPoints: DangerPoint[];
};

// A map saved to the library independently of any campaign. Holds the board
// image, areas, and one or more loot presets. Carries over between setups and
// is exported/imported on its own (see MapFile in storage.ts).
export type SavedMap = {
  id: string;
  name: string;
  savedAt: number;
  mapImage: string;
  areas: Area[];
  lootPresets: LootPreset[];
  activeLootPresetId: string;
};

export type Campaign = {
  version: 5;
  name: string;
  mapImage: string;
  areas: Area[];
  characters: Character[];
  phraseSource: string;
  stayChance: number;
  weapons: MapWeapon[];
  crates: Crate[];
  healingPoints: HealingPoint[];
  dangerPoints: DangerPoint[];
  settings: Settings;
  screen: Screen;
  game: GameState;
  // Id of the SavedMap the live board (areas/mapImage/weapons/crates/points)
  // was projected from, used for Save-map-back behavior. Undefined for pre-v5
  // saves until the user saves the live board into the map library.
  activeMapId?: string;
};
