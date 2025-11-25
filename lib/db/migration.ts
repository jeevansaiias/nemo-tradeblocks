/**
 * DB migration helper: copy data from an existing IndexedDB database name to a new name.
 * This is a client-side, best-effort migration intended to be triggered once by the user.
 */
import { DB_VERSION, STORES } from './index';

export interface MigrationResult {
  migrated: boolean;
  details: Record<string, { oldCount: number; newCount: number }>;
}

// helper removed — keeping implementation inline for clarity

function createNewDB(newName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(newName, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create expected stores if missing
      if (!db.objectStoreNames.contains(STORES.BLOCKS)) {
        const s = db.createObjectStore(STORES.BLOCKS, { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.TRADES)) {
        const s = db.createObjectStore(STORES.TRADES, { autoIncrement: true });
        s.createIndex('blockId', 'blockId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.DAILY_LOGS)) {
        db.createObjectStore(STORES.DAILY_LOGS, { autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.CALCULATIONS)) {
        db.createObjectStore(STORES.CALCULATIONS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.REPORTING_LOGS)) {
        db.createObjectStore(STORES.REPORTING_LOGS, { autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
  });
}

export async function migrateDatabaseName(
  oldName = 'TradeBlocksDB',
  newName = 'NemoBlocksDB'
): Promise<MigrationResult> {
  // Best-effort: do not throw for recoverable failures
  const details: Record<string, { oldCount: number; newCount: number }> = {};

  // Try detect old DB existence without accidentally creating it.
  let oldDb: IDBDatabase | null = null;

  await new Promise<void>((resolve) => {
    const req = indexedDB.open(oldName);
    let upgradeFired = false;

    req.onupgradeneeded = () => {
      // If upgrade fires when opening without an explicit version, it likely means DB did not exist
      upgradeFired = true;
    };

    req.onsuccess = () => {
      if (upgradeFired) {
        // We don't want to create an empty old DB — delete the temp DB and proceed as if old DB absent
        const createdDb = req.result;
        createdDb.close();
        const delReq = indexedDB.deleteDatabase(oldName);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => resolve();
      } else {
        oldDb = req.result;
        resolve();
      }
    };

    req.onerror = () => resolve();
  });

  // Create or open the new DB and ensure schema exists
  let newDb: IDBDatabase;
  try {
    newDb = await createNewDB(newName);
  } catch {
    // If we cannot create the new DB, abort migration
    return { migrated: false, details };
  }

  if (!oldDb) {
    // Nothing to migrate — close newDb and return
    newDb.close();
    return { migrated: false, details };
  }
  const old = oldDb as IDBDatabase;

  try {
    // For each store, copy records
    for (const storeKey of Object.values(STORES)) {
      const storeName = storeKey as string;
      details[storeName] = { oldCount: 0, newCount: 0 };

      if (!old.objectStoreNames.contains(storeName)) continue;

      // Read from old DB
      await new Promise<void>((resolve) => {
  const readTx = old.transaction(storeName, 'readonly');
        const readStore = readTx.objectStore(storeName);
        const getAllReq = readStore.getAll();
        getAllReq.onsuccess = async () => {
          const items = getAllReq.result as unknown[];
          details[storeName].oldCount = items.length;

          if (items.length === 0) {
            resolve();
            return;
          }

          // Write into new DB
          const writeTx = newDb.transaction(storeName, 'readwrite');
          const writeStore = writeTx.objectStore(storeName);
          let written = 0;

          for (const item of items) {
            const putReq = writeStore.put(item);
            putReq.onsuccess = () => {
              written += 1;
            };
          }

          writeTx.oncomplete = () => {
            details[storeName].newCount = written;
            resolve();
          };

          writeTx.onerror = () => resolve();
        };

        getAllReq.onerror = () => resolve();
      });
    }
  } finally {
    old.close();
    newDb.close();
  }

  // Mark migration as complete in localStorage so we don't rerun automatically
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nemoblocks-db-migrated', new Date().toISOString());
    }
  } catch {
    // best-effort
  }

  return { migrated: true, details };
}
