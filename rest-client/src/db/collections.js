import { getDB } from './index';

const STORE = 'collections';

export async function getCollections() {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function saveCollection(collection) {
  const db = await getDB();
  await db.put(STORE, collection);
}

export async function deleteCollection(id) {
  const db = await getDB();
  await db.delete(STORE, id);
}
