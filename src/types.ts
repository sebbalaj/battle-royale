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

export type Character = {
  id: string;
  name: string;
  portrait: string;
  startAreaId: string;
  areaId: string;
  status: CharacterStatus;
  power: number;
  invulnerable: boolean;
  weapon?: WeaponType;
  lastOpponentId?: string;
  deathCause?: string;
  diedInRound?: number;
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

export type Campaign = {
  version: 3;
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
};
