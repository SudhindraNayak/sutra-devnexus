import { getDB } from './index';

const STORE = 'oauth_tokens';

export async function getOAuthTokens() {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function saveOAuthToken(token) {
  const db = await getDB();
  await db.put(STORE, token);
}

export async function deleteOAuthToken(id) {
  const db = await getDB();
  await db.delete(STORE, id);
}
