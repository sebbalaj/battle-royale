import type { Campaign, LayoutSlot } from "./types";

const DB_NAME = "battle-royale-local";
const STORE_NAME = "campaigns";
const LAYOUT_STORE_NAME = "layouts";
const CAMPAIGN_KEY = "current";
const DB_VERSION = 2;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(LAYOUT_STORE_NAME)) {
        database.createObjectStore(LAYOUT_STORE_NAME);
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

// --- Backup export / import ----------------------------------------------

// Shape of a full backup file: the current campaign plus every saved layout.
export type BackupFile = {
  format: "battle-royale-backup";
  version: 1;
  exportedAt: number;
  campaign: Campaign;
  layouts: LayoutSlot[];
};

export const exportBackup = async (): Promise<BackupFile> => {
  const [campaign, layouts] = await Promise.all([loadCampaign(), listLayouts()]);
  return {
    format: "battle-royale-backup",
    version: 1,
    exportedAt: Date.now(),
    campaign: campaign as Campaign,
    layouts,
  };
};

// Validate a parsed backup object before importing it.
export const isBackupFile = (value: unknown): value is BackupFile => {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<BackupFile>;
  return file.format === "battle-royale-backup" && Boolean(file.campaign) && Array.isArray(file.layouts);
};

// Replace the current campaign and merge the backup's layouts into storage.
// Returns the imported campaign so the caller can load it into app state.
export const importBackup = async (file: BackupFile): Promise<Campaign> => {
  await saveCampaign(file.campaign);
  for (const slot of file.layouts) {
    await saveLayout(slot);
  }
  return file.campaign;
};
