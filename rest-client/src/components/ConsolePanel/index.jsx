import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useConsole } from '../../hooks/useConsole';
import { saveSettings, getSettings } from '../../db/settings';
import styles from './styles.module.css';

const LEVELS = ['all', 'error', 'warn', 'info'];
const LEVEL_LABELS = { all: 'All', error: 'Errors', warn: 'Warnings', info: 'Info' };

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 560;
const DEFAULT_HEIGHT = 220;

const LEVEL_ICONS = {
  error: { symbol: '●', cls: 'error' },
  warn:  { symbol: '●', cls: 'warn' },
  info:  { symbol: '●', cls: 'info' },
};

function formatTs(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ConsolePanel() {
  const { logs, clearLogs } = useConsole();

  const [isOpen,   setIsOpen]   = useState(false);
  const [height,   setHeight]   = useState(DEFAULT_HEIGHT);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const dragging       = useRef(false);
  const dragStartY     = useRef(0);
  const dragStartH     = useRef(0);
  const logsEndRef     = useRef(null);
  const prevLogsLength = useRef(0);

  // Load persisted open/height state
  useEffect(() => {
    getSettings().then((s) => {
      if (s.consoleOpen   !== undefined) setIsOpen(s.consoleOpen);
      if (s.consoleHeight !== undefined) setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, s.consoleHeight)));
    });
  }, []);

  useEffect(() => { saveSettings({ consoleOpen: isOpen }); }, [isOpen]);
  useEffect(() => { saveSettings({ consoleHeight: height }); }, [height]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && logs.length !== prevLogsLength.current) {
      prevLogsLength.current = logs.length;
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  // ── Drag handle ──────────────────────────────────────────────────────────

  const onDragStart = useCallback((e) => {
    dragging.current   = true;
    dragStartY.current = e.clientY;
    dragStartH.current = height;
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'row-resize';
  }, [height]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta  = dragStartY.current - e.clientY;
      const newH   = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartH.current + delta));
      setHeight(newH);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Filtered logs ────────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => {
    const lc = search.toLowerCase();
    return logs.filter((entry) => {
      if (filter !== 'all' && entry.level !== filter) return false;
      if (search && !entry.message.toLowerCase().includes(lc) && !(entry.detail && entry.detail.toLowerCase().includes(lc))) return false;
      return true;
    });
  }, [logs, filter, search]);

  // Badge counts
  const errorCount = useMemo(() => logs.filter((l) => l.level === 'error').length, [logs]);
  const warnCount  = useMemo(() => logs.filter((l) => l.level === 'warn').length,  [logs]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const toggleExpanded = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const copyLogs = useCallback(() => {
    const text = JSON.stringify(filteredLogs.map(({ id, timestamp, level, message, detail }) => ({ id, timestamp, level, message, detail })), null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  }, [filteredLogs]);

  return (
    <div
      className={`${styles.console} ${isOpen ? styles.open : ''}`}
      style={isOpen ? { height } : {}}
    >
      {/* ── Drag handle ── */}
      {isOpen && <div className={styles.dragHandle} onMouseDown={onDragStart} />}

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button className={styles.toggleBtn} onClick={() => setIsOpen((o) => !o)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isOpen
              ? <polyline points="18 15 12 9 6 15" />
              : <polyline points="6 9 12 15 18 9" />}
          </svg>
          Console
          {errorCount > 0 && <span className={`${styles.badge} ${styles.badgeError}`}>{errorCount}</span>}
          {warnCount  > 0 && <span className={`${styles.badge} ${styles.badgeWarn}`}>{warnCount}</span>}
        </button>

        {isOpen && (
          <>
            <div className={styles.levelFilters}>
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  className={`${styles.levelBtn} ${filter === lvl ? styles.levelActive : ''} ${lvl !== 'all' ? styles[`level_${lvl}`] : ''}`}
                  onClick={() => setFilter(lvl)}
                >
                  {LEVEL_LABELS[lvl]}
                  {lvl !== 'all' && <span className={styles.levelCount}>{logs.filter((l) => l.level === lvl).length}</span>}
                </button>
              ))}
            </div>

            <input
              className={styles.searchInput}
              placeholder="Filter logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.toolbarRight}>
              <button className={styles.iconActionBtn} onClick={copyLogs} title="Copy logs as JSON">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button className={styles.iconActionBtn} onClick={clearLogs} title="Clear console">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Log entries ── */}
      {isOpen && (
        <div className={styles.logList}>
          {filteredLogs.length === 0 && (
            <div className={styles.empty}>
              {logs.length === 0 ? 'No logs yet. Send a request to see output here.' : 'No entries match the current filter.'}
            </div>
          )}

          {filteredLogs.map((entry) => {
            const icon = LEVEL_ICONS[entry.level] || LEVEL_ICONS.info;
            const isExp = expanded.has(entry.id);

            return (
              <div
                key={entry.id}
                className={`${styles.entry} ${styles[`entry_${entry.level}`]} ${entry.detail ? styles.hasDetail : ''}`}
                onClick={() => entry.detail && toggleExpanded(entry.id)}
              >
                <div className={styles.entryMain}>
                  <span className={`${styles.levelDot} ${styles[icon.cls]}`}>{icon.symbol}</span>
                  <span className={styles.ts}>{formatTs(entry.timestamp)}</span>
                  <span className={styles.msg}>{entry.message}</span>
                  {entry.detail && (
                    <svg
                      className={`${styles.expandChevron} ${isExp ? styles.expandChevronOpen : ''}`}
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
                {isExp && entry.detail && (
                  <pre className={styles.entryDetail}>{entry.detail}</pre>
                )}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
