import { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../hooks/useTheme';
import { formatBytes, formatTime, detectLanguage, getStatusClass, formatJson } from '../../utils/formatters';
import styles from './styles.module.css';

const TABS = ['body', 'headers', 'info'];

export function ResponsePanel({ response }) {
  const [activeTab, setActiveTab] = useState('body');
  const { theme } = useTheme();

  const language = useMemo(() => {
    if (!response) return 'text';
    return detectLanguage(response.headers || {});
  }, [response]);

  const formattedBody = useMemo(() => {
    if (!response?.body) return '';
    if (language === 'json') return formatJson(response.body);
    return response.body;
  }, [response, language]);

  const responseHeaders = useMemo(() => {
    if (!response?.headers) return [];
    return Object.entries(response.headers).map(([key, value]) => ({ key, value }));
  }, [response]);

  const statusClass = response ? getStatusClass(response.status) : null;
  const hlStyle = theme === 'dark' ? vscDarkPlus : vs;

  if (!response) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
        <p>Send a request to see the response</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={`${styles.statusCode} ${styles[statusClass]}`}>
            {response.status || 'ERR'} {response.statusText}
          </span>
          <span className={styles.stat}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTime(response.time)}
          </span>
          <span className={styles.stat}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {formatBytes(response.size)}
          </span>
        </div>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'headers' && ` (${responseHeaders.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {activeTab === 'body' && (
          <div className={styles.bodyContent}>
            {formattedBody ? (
              <SyntaxHighlighter
                language={language === 'text' ? 'plaintext' : language}
                style={hlStyle}
                customStyle={{
                  margin: 0,
                  padding: '14px 16px',
                  background: 'transparent',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: '1.6',
                }}
                showLineNumbers={formattedBody.split('\n').length > 5}
                wrapLongLines={false}
              >
                {formattedBody}
              </SyntaxHighlighter>
            ) : (
              <div className={styles.emptyBody}>No body in response.</div>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className={styles.headersContent}>
            {responseHeaders.length === 0 ? (
              <div className={styles.emptyBody}>No headers.</div>
            ) : (
              <table className={styles.headerTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {responseHeaders.map(({ key, value }) => (
                    <tr key={key}>
                      <td className={styles.headerKey}>{key}</td>
                      <td className={styles.headerValue}>{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className={styles.infoContent}>
            <div className={styles.infoRow}><span>Status</span><strong>{response.status} {response.statusText}</strong></div>
            <div className={styles.infoRow}><span>Time</span><strong>{formatTime(response.time)}</strong></div>
            <div className={styles.infoRow}><span>Size</span><strong>{formatBytes(response.size)}</strong></div>
            <div className={styles.infoRow}><span>Content Type</span><strong>{response.headers?.['content-type'] || response.headers?.['Content-Type'] || '—'}</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}
