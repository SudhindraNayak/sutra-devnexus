import { getDB } from './index';

const STORE = 'history';
const MAX_ENTRIES = 100;

export async function addHistory(entry) {
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

export async function getHistory() {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, 'by-timestamp');
  return all.reverse();
}

export async function clearHistory() {
  const db = await getDB();
  await db.clear(STORE);
}

export async function deleteHistoryEntry(id) {
  const db = await getDB();
  await db.delete(STORE, id);
}
