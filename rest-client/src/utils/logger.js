import { v4 as uuidv4 } from 'uuid';
import { addConsoleLog, getConsoleLogs, clearConsoleLogs } from '../db/consoleLogs';

const MAX_LOGS = 500;
const subscribers = new Set();
let logs = [];
let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  try {
    const stored = await getConsoleLogs();
    logs = stored.slice(0, MAX_LOGS);
    notifyAll();
  } catch {
    // DB not yet ready — start with empty log array
  }
}

function notifyAll() {
  const snapshot = [...logs];
  subscribers.forEach((cb) => cb(snapshot));
}

export function log(level, message, detail = null) {
  const entry = {
    id: uuidv4(),
    timestamp: Date.now(),
    level, // 'error' | 'warn' | 'info'
    message,
    detail: detail ? String(detail) : null,
  };
  logs = [entry, ...logs].slice(0, MAX_LOGS);
  notifyAll();
  addConsoleLog(entry).catch(() => {});
}

export function clearLogs() {
  logs = [];
  notifyAll();
  clearConsoleLogs().catch(() => {});
}

export function subscribe(callback) {
  subscribers.add(callback);
  callback([...logs]);
  return () => subscribers.delete(callback);
}

export function getLogs() {
  return [...logs];
}

init();
