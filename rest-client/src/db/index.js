import { openDB } from 'idb';

const DB_NAME = 'rest-client-db';
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id' });
          historyStore.createIndex('by-timestamp', 'timestamp');
          db.createObjectStore('collections', { keyPath: 'id' });
          db.createObjectStore('environments', { keyPath: 'id' });
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('oauth_tokens')) {
            db.createObjectStore('oauth_tokens', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('console_logs')) {
            const logsStore = db.createObjectStore('console_logs', { keyPath: 'id' });
            logsStore.createIndex('by-timestamp', 'timestamp');
          }
        }
      },
    });
  }
  return dbPromise;
}
