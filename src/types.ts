export type Screen = "setup" | "game";
export type GamePhase = "ready" | "outcome-hidden" | "revealed";
export type CharacterStatus = "active" | "defeated";

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
  defeatedInRound?: number;
};

export type Movement = {
  characterId: string;
  fromAreaId: string;
  toAreaId: string;
};

export type ConflictOutcome = {
  areaId: string;
  participantIds: string[];
  winnerId: string;
  loserIds: string[];
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
  version: 1;
  name: string;
  mapImage: string;
  areas: Area[];
  characters: Character[];
  phraseSource: string;
  stayChance: number;
  screen: Screen;
  game: GameState;
};
