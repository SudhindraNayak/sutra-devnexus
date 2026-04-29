import { useCallback } from 'react';
import { useHistory } from '../../hooks/useHistory';
import { getStatusClass, formatTimestamp, formatTime } from '../../utils/formatters';
import styles from './styles.module.css';

const METHOD_COLORS = {
  GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch',
  DELETE: 'delete', HEAD: 'head', OPTIONS: 'options',
};

export function HistoryPanel({ onLoadRequest }) {
  const { history, loading, clear, remove } = useHistory();

  const handleLoad = useCallback(
    (entry) => {
      onLoadRequest({
        method: entry.method,
        url: entry.url,
        params: entry.params || [],
        headers: entry.headers || [],
        body: entry.body || { type: 'none', content: '', fields: [] },
        auth: entry.auth || { type: 'none' },
      });
    },
    [onLoadRequest]
  );

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>History</span>
        {history.length > 0 && (
          <button className={styles.clearBtn} onClick={clear} title="Clear history">
            Clear
          </button>
        )}
      </div>

      <div className={styles.list}>
        {history.length === 0 && (
          <div className={styles.empty}>No request history yet.</div>
        )}
        {history.map((entry) => (
          <div key={entry.id} className={styles.entry} onClick={() => handleLoad(entry)}>
            <div className={styles.entryTop}>
              <span className={`${styles.methodBadge} ${styles[METHOD_COLORS[entry.method] || 'get']}`}>
                {entry.method}
              </span>
              {entry.status ? (
                <span className={`${styles.status} ${styles[getStatusClass(entry.status)]}`}>
                  {entry.status}
                </span>
              ) : null}
              <span className={styles.time}>{formatTimestamp(entry.timestamp)}</span>
              <span className={styles.duration}>{formatTime(entry.responseTime)}</span>
              <button
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); remove(entry.id); }}
                title="Remove"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.url} title={entry.url}>{entry.url}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
