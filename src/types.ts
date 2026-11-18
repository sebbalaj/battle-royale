export type Screen = "setup" | "game";
export type GamePhase = "ready" | "outcome-hidden" | "revealed";
export type CharacterStatus = "active" | "dead";
export type LoserFate = "died" | "escaped";

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
  lastOpponentId?: string;
  deathCause?: string;
  diedInRound?: number;
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

export type RoundRecord = {
  round: number;
  movements: Movement[];
  conflicts: ConflictOutcome[];
  basicText: string;
  conflictText: string;
  revealed: boolean;
};

export type GameState = {
  round: number;
  phase: GamePhase;
  pendingOutcomes: ConflictOutcome[];
  currentBasicText: string;
  currentConflictText: string;
  history: RoundRecord[];
};

export type Campaign = {
  version: 2;
  name: string;
  mapImage: string;
  areas: Area[];
  characters: Character[];
  phraseSource: string;
  stayChance: number;
  screen: Screen;
  game: GameState;
};
