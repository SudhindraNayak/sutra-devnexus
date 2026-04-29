import { getDB } from './index';

const STORE = 'settings';
const KEY = 'app-settings';

const DEFAULTS = {
  id: KEY,
  theme: 'dark',
  activeEnvironmentId: null,
};

export async function getSettings() {
  const db = await getDB();
  const s = await db.get(STORE, KEY);
  return { ...DEFAULTS, ...s };
}

export async function saveSettings(partial) {
  const db = await getDB();
  const current = await getSettings();
  await db.put(STORE, { ...current, ...partial });
}
