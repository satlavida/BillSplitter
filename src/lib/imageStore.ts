import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'billSplitterImages';
const DB_VERSION = 1;
const STORE_NAME = 'receiptImages';

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDb = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Receipt images are kept out of the localStorage-backed sessionStore
 * (dataURLs at scan resolution run ~200-500KB each and would quickly blow
 * localStorage's ~5-10MB quota) - only a {refKey, width, height} reference
 * lives in Bill.receiptImage; the actual bytes live here in IndexedDB,
 * keyed by refKey.
 */
export const saveImageBlob = async (refKey: string, blob: Blob): Promise<void> => {
  const db = await getDb();
  await db.put(STORE_NAME, blob, refKey);
};

export const getImageBlob = async (refKey: string): Promise<Blob | undefined> => {
  const db = await getDb();
  return db.get(STORE_NAME, refKey);
};

export const deleteImageBlob = async (refKey: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORE_NAME, refKey);
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};
