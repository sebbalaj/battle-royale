import type { WeaponType } from "./types";

export const WEAPON_TYPES: WeaponType[] = ["suppressed-pistol", "sniper", "knife", "shotgun"];

export const WEAPON_NAMES: Record<WeaponType, string> = {
  "suppressed-pistol": "Suppressed Pistol",
  sniper: "Sniper",
  knife: "Knife",
  shotgun: "Shotgun",
};

export const WEAPON_GLYPHS: Record<WeaponType, string> = {
  "suppressed-pistol": "🔫",
  sniper: "🎯",
  knife: "🔪",
  shotgun: "💥",
};

export const weaponName = (weapon?: WeaponType): string => (weapon ? WEAPON_NAMES[weapon] : "None");

export type WeaponSlot = "combat" | "ranged";

// Which inventory slot a weapon occupies. Only the sniper is ranged today, but
// the model is kept general so more ranged weapons can be added later.
export const WEAPON_SLOTS: Record<WeaponType, WeaponSlot> = {
  "suppressed-pistol": "combat",
  sniper: "ranged",
  knife: "combat",
  shotgun: "combat",
};

export const weaponSlot = (weapon: WeaponType): WeaponSlot => WEAPON_SLOTS[weapon];
