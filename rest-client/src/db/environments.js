import { getDB } from './index';

const STORE = 'environments';

export async function getEnvironments() {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function saveEnvironment(environment) {
  const db = await getDB();
  await db.put(STORE, environment);
}

export async function deleteEnvironment(id) {
  const db = await getDB();
  await db.delete(STORE, id);
}
