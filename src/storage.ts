import type { Campaign } from "./types";

const DB_NAME = "battle-royale-local";
const STORE_NAME = "campaigns";
const CAMPAIGN_KEY = "current";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
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
