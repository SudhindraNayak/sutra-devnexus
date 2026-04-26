import { useState } from 'react';
import { KeyValueEditor } from '../KeyValueEditor';
import { BodyEditor } from '../BodyEditor';
import { AuthPanel } from '../AuthPanel';
import styles from './styles.module.css';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const TABS = ['params', 'headers', 'body', 'auth'];

export function RequestPanel({ request, onChange, onSend, onSave, loading }) {
  const [activeTab, setActiveTab] = useState('params');

  const set = (field, value) => onChange({ ...request, [field]: value });

  const tabLabels = {
    params: `Params${request.params?.filter(p => p.key).length ? ` (${request.params.filter(p => p.key).length})` : ''}`,
    headers: `Headers${request.headers?.filter(h => h.key).length ? ` (${request.headers.filter(h => h.key).length})` : ''}`,
    body: `Body${request.body?.type !== 'none' ? ' •' : ''}`,
    auth: `Auth${request.auth?.type !== 'none' ? ' •' : ''}`,
  };

  return (
    <div className={styles.panel}>
      <div className={styles.urlBar}>
        <select
          className={`${styles.methodSelect} ${styles[`method_${request.method?.toLowerCase()}`]}`}
          value={request.method}
          onChange={(e) => set('method', e.target.value)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          className={styles.urlInput}
          type="text"
          placeholder="https://api.example.com/endpoint  or  {{BASE_URL}}/path"
          value={request.url}
          onChange={(e) => set('url', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          spellCheck={false}
        />
        <button className={styles.saveBtn} onClick={onSave} title="Save to collection">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save
        </button>
        <button
          className={`${styles.sendBtn} ${loading ? styles.sending : ''}`}
          onClick={onSend}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Sending
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send
            </>
          )}
        </button>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'params' && (
          <KeyValueEditor
            items={request.params || []}
            onChange={(v) => set('params', v)}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
          />
        )}
        {activeTab === 'headers' && (
          <KeyValueEditor
            items={request.headers || []}
            onChange={(v) => set('headers', v)}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
          />
        )}
        {activeTab === 'body' && (
          <BodyEditor body={request.body} onChange={(v) => set('body', v)} />
        )}
        {activeTab === 'auth' && (
          <AuthPanel auth={request.auth} onChange={(v) => set('auth', v)} />
        )}
      </div>
    </div>
  );
}
