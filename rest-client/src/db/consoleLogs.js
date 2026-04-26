import { getDB } from './index';

const STORE = 'console_logs';
const MAX_ENTRIES = 500;

export async function addConsoleLog(entry) {
  const db = await getDB();
  await db.put(STORE, entry);
  const all = await db.getAllFromIndex(STORE, 'by-timestamp');
  if (all.length > MAX_ENTRIES) {
    const toDelete = all.slice(0, all.length - MAX_ENTRIES);
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all(toDelete.map((e) => tx.store.delete(e.id)));
    await tx.done;
  }
}

export async function getConsoleLogs() {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, 'by-timestamp');
  return all.reverse();
}

export async function clearConsoleLogs() {
  const db = await getDB();
  await db.clear(STORE);
}
