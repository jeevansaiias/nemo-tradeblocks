(function () {
  const DB_NAME = 'tradeblocks-cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'records';

  function openDb() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'client_key' });
          store.createIndex('updated_at', 'updated_at');
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function withStore(mode, fn) {
    const db = await openDb();
    if (!db) {
      return undefined;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = fn(store, tx);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getRecord(clientKey) {
    if (!clientKey) {
      return undefined;
    }
    return withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(clientKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async function putRecord(record) {
    return withStore('readwrite', (store) => {
      store.put(record);
    });
  }

  async function getLatestRecord() {
    return withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const index = store.index('updated_at');
        const request = index.openCursor(null, 'prev');
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            resolve(cursor.value);
          } else {
            resolve(undefined);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  function sanitizePortfolioPayload(payload) {
    if (!payload) {
      return undefined;
    }
    return {
      filename: payload.filename,
      csv_base64: payload.csv_base64,
      portfolio_id: payload.portfolio_id,
      summary: payload.summary || null,
      saved_at: payload.saved_at,
    };
  }

  function sanitizeDailyLogPayload(payload) {
    if (!payload) {
      return undefined;
    }
    return {
      filename: payload.filename,
      csv_base64: payload.csv_base64,
      portfolio_id: payload.portfolio_id,
      summary: payload.summary || null,
      saved_at: payload.saved_at,
    };
  }

  async function savePortfolio(payload) {
    if (!payload || !payload.client_key || !payload.csv_base64) {
      return;
    }
    const record = (await getRecord(payload.client_key)) || { client_key: payload.client_key };
    record.portfolio = sanitizePortfolioPayload(payload);
    record.updated_at = payload.saved_at || new Date().toISOString();
    if (payload.portfolio_id) {
      record.last_portfolio_id = payload.portfolio_id;
    }
    await putRecord(record);
  }

  async function saveDailyLog(payload) {
    if (!payload || !payload.client_key || !payload.csv_base64) {
      return;
    }
    const record = (await getRecord(payload.client_key)) || { client_key: payload.client_key };
    record.daily_log = sanitizeDailyLogPayload(payload);
    record.updated_at = payload.saved_at || new Date().toISOString();
    await putRecord(record);
  }

  async function getLatestPayload() {
    const record = await getLatestRecord();
    if (!record || !record.portfolio) {
      return undefined;
    }
    return {
      client_key: record.client_key,
      portfolio: record.portfolio,
      daily_log: record.daily_log || null,
    };
  }

  async function clearAll() {
    const db = await openDb();
    if (!db) {
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  window.tradeblocksStorage = {
    savePortfolio,
    saveDailyLog,
    getLatestPayload,
    clearAll,
  };
})();
