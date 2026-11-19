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
