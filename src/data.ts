import type { Campaign, Character, GameState } from "./types";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

export const emptyGameState = (): GameState => ({
  round: 0,
  phase: "ready",
  pendingOutcomes: [],
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
  version: 2,
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
  screen: "setup",
  game: emptyGameState(),
});

type StoredCharacter = Partial<Omit<Character, "status">> & { status?: string };
type StoredCampaign = Partial<Omit<Campaign, "characters" | "version">> & {
  version?: number;
  characters?: StoredCharacter[];
};

export const migrateCampaign = (saved: unknown): Campaign | undefined => {
  if (!saved || typeof saved !== "object") return undefined;
  const stored = saved as StoredCampaign;
  if (!stored.name || !stored.mapImage || !stored.areas || !stored.characters || !stored.phraseSource) return undefined;

  const characters: Character[] = stored.characters.map((character, index) => ({
    id: character.id ?? crypto.randomUUID(),
    name: character.name ?? `Character ${index + 1}`,
    portrait: character.portrait ?? asset(`portrait-${(index % 4) + 1}.svg`),
    startAreaId: character.startAreaId ?? stored.areas?.[0]?.id ?? "",
    areaId: character.areaId ?? character.startAreaId ?? stored.areas?.[0]?.id ?? "",
    status: character.status === "defeated" || character.status === "dead" ? "dead" : "active",
    power: Number.isFinite(character.power) ? Number(character.power) : 7,
    invulnerable: Boolean(character.invulnerable),
    lastOpponentId: character.lastOpponentId,
    deathCause: character.deathCause,
    diedInRound: character.diedInRound,
  }));

  return {
    version: 2,
    name: stored.name,
    mapImage: stored.mapImage,
    areas: stored.areas,
    characters,
    phraseSource: stored.phraseSource,
    stayChance: stored.stayChance ?? 0.5,
    screen: stored.version === 2 ? stored.screen ?? "setup" : "setup",
    game: stored.version === 2 && stored.game ? stored.game : emptyGameState(),
  };
};
