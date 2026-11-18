import type { Campaign, GameState } from "./types";

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

export const emptyGameState = (): GameState => ({
  round: 0,
  phase: "ready",
  pendingOutcomes: [],
  currentBasicText: "",
  currentConflictText: "",
  history: [],
});

export const createDefaultCampaign = (): Campaign => ({
  version: 1,
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
    { id: "mara", name: "Mara Vex", portrait: asset("portrait-1.svg"), startAreaId: "port", areaId: "port", status: "active" },
    { id: "orin", name: "Orin Ash", portrait: asset("portrait-2.svg"), startAreaId: "keep", areaId: "keep", status: "active" },
    { id: "sable", name: "Sable Thorn", portrait: asset("portrait-3.svg"), startAreaId: "oldwood", areaId: "oldwood", status: "active" },
    { id: "lyra", name: "Lyra Vale", portrait: asset("portrait-4.svg"), startAreaId: "watch", areaId: "watch", status: "active" },
  ],
  phraseSource: "fog; broken sword; betrayal; silent footsteps; red moon; hidden passage; ancient debt; sudden storm; burning banner; whispered warning; lost crown; poisoned river; unexpected ally; distant bells; final oath; shattered shield",
  stayChance: 0.5,
  screen: "setup",
  game: emptyGameState(),
});
