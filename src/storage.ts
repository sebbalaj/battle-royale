import type { Attire, Campaign, Character, LayoutSlot, SavedMap } from "./types";

const DB_NAME = "battle-royale-local";
const STORE_NAME = "campaigns";
const LAYOUT_STORE_NAME = "layouts";
// Map library and persistent roster stores (added in DB_VERSION 3). Both are
// keyed by the stored item's id and survive campaign resets/new games/imports.
const MAP_STORE_NAME = "maps";
const CHARACTER_STORE_NAME = "characters";
const CAMPAIGN_KEY = "current";
const DB_VERSION = 3;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      // Keep creating the legacy stores so old data survives the upgrade.
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(LAYOUT_STORE_NAME)) {
        database.createObjectStore(LAYOUT_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(MAP_STORE_NAME)) {
        database.createObjectStore(MAP_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(CHARACTER_STORE_NAME)) {
        database.createObjectStore(CHARACTER_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const loadCampaign = async (): Promise<unknown> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(CAMPAIGN_KEY);
    request.onsuccess = () => resolve(request.result as unknown);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

export const saveCampaign = async (campaign: Campaign): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(campaign, CAMPAIGN_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const listLayouts = async (): Promise<LayoutSlot[]> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LAYOUT_STORE_NAME, "readonly");
    const request = transaction.objectStore(LAYOUT_STORE_NAME).getAll();
    request.onsuccess = () => {
      const slots = (request.result as LayoutSlot[]) ?? [];
      slots.sort((a, b) => b.savedAt - a.savedAt);
      resolve(slots);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

export const saveLayout = async (slot: LayoutSlot): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LAYOUT_STORE_NAME, "readwrite");
    transaction.objectStore(LAYOUT_STORE_NAME).put(slot, slot.id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteLayout = async (id: string): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LAYOUT_STORE_NAME, "readwrite");
    transaction.objectStore(LAYOUT_STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

// --- Map library ----------------------------------------------------------

// The 'maps' store holds SavedMap definitions independent of any campaign, so
// a user can build up a library of maps that carry across setups.
export const listMaps = async (): Promise<SavedMap[]> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MAP_STORE_NAME, "readonly");
    const request = transaction.objectStore(MAP_STORE_NAME).getAll();
    request.onsuccess = () => {
      const maps = (request.result as SavedMap[]) ?? [];
      maps.sort((a, b) => b.savedAt - a.savedAt);
      resolve(maps);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

export const saveMap = async (map: SavedMap): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MAP_STORE_NAME, "readwrite");
    transaction.objectStore(MAP_STORE_NAME).put(map, map.id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteMap = async (id: string): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MAP_STORE_NAME, "readwrite");
    transaction.objectStore(MAP_STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

// --- Persistent roster -----------------------------------------------------

// Roster-store contract: the 'characters' store persists the editable
// character DEFINITIONS (name, attires, weapons, power/invulnerable/sitOut,
// startAreaId) independent of the live campaign. The live campaign.characters
// stays the working copy and is synced into this store on save. The runtime-only
// deadBodyImage is stripped before storing, since it is per-game state.
const toRosterCharacter = (character: Character): Character => {
  const { deadBodyImage: _deadBodyImage, ...rest } = character;
  return rest;
};

export const listRosterCharacters = async (): Promise<Character[]> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CHARACTER_STORE_NAME, "readonly");
    const request = transaction.objectStore(CHARACTER_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as Character[]) ?? []);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

export const saveRosterCharacter = async (character: Character): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CHARACTER_STORE_NAME, "readwrite");
    transaction.objectStore(CHARACTER_STORE_NAME).put(toRosterCharacter(character), character.id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteRosterCharacter = async (id: string): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CHARACTER_STORE_NAME, "readwrite");
    transaction.objectStore(CHARACTER_STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

// --- Backup export / import ----------------------------------------------

// Shape of a full backup file: the current campaign, every saved layout, and
// (from version 2) the map library and persistent roster. Version 1 files are
// still accepted on import; their missing maps/characters default to [].
export type BackupFile = {
  format: "battle-royale-backup";
  version: 2;
  exportedAt: number;
  campaign: Campaign;
  layouts: LayoutSlot[];
  maps: SavedMap[];
  characters: Character[];
};

export const exportBackup = async (): Promise<BackupFile> => {
  const [campaign, layouts, maps, characters] = await Promise.all([
    loadCampaign(),
    listLayouts(),
    listMaps(),
    listRosterCharacters(),
  ]);
  return {
    format: "battle-royale-backup",
    version: 2,
    exportedAt: Date.now(),
    campaign: campaign as Campaign,
    layouts,
    maps,
    characters,
  };
};

// Validate a parsed backup object before importing it. Tolerant of version 1
// files that predate the maps/characters arrays.
export const isBackupFile = (value: unknown): value is BackupFile => {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<BackupFile>;
  return file.format === "battle-royale-backup" && Boolean(file.campaign) && Array.isArray(file.layouts);
};

// Replace the current campaign and MERGE the backup's layouts, maps, and roster
// characters into storage. Existing maps/roster not present in the file are not
// deleted (put semantics). Returns the imported campaign for app state.
export const importBackup = async (file: BackupFile): Promise<Campaign> => {
  await saveCampaign(file.campaign);
  for (const slot of file.layouts) {
    await saveLayout(slot);
  }
  for (const map of file.maps ?? []) {
    await saveMap(map);
  }
  for (const character of file.characters ?? []) {
    await saveRosterCharacter(character);
  }
  return file.campaign;
};

// --- Per-item export / import (map & attire) -------------------------------

// A single exported map. version bumps if the SavedMap shape changes.
export type MapFile = {
  format: "battle-royale-map";
  version: 1;
  map: SavedMap;
};

export const isMapFile = (value: unknown): value is MapFile => {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<MapFile>;
  return file.format === "battle-royale-map" && Boolean(file.map) && typeof file.map === "object";
};

// Put an imported map into the library under a FRESH id so it never clobbers an
// existing map with the same id. Returns the stored map (with its new id).
export const importMap = async (file: MapFile): Promise<SavedMap> => {
  const map: SavedMap = { ...file.map, id: crypto.randomUUID() };
  await saveMap(map);
  return map;
};

// A single exported attire. The UI feature wires this into the attire cycler.
export type AttireFile = {
  format: "battle-royale-attire";
  version: 1;
  attire: Attire;
};

export const isAttireFile = (value: unknown): value is AttireFile => {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<AttireFile>;
  return file.format === "battle-royale-attire" && Boolean(file.attire) && typeof file.attire === "object";
};
