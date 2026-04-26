import { useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { ThemeProvider } from './context/ThemeContext';
import { EnvironmentProvider } from './context/EnvironmentContext';
import { useRequest } from './hooks/useRequest';
import { useHistory } from './hooks/useHistory';
import { useEnvironment } from './hooks/useEnvironment';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { CollectionsSidebar } from './components/CollectionsSidebar';
import { HistoryPanel } from './components/HistoryPanel';
import { EnvironmentManager } from './components/EnvironmentManager';
import { PostmanImporter } from './components/PostmanImporter';
import { SaveRequestModal } from './components/SaveRequestModal';
import { ThemeToggle } from './components/ThemeToggle';
import { ConsolePanel } from './components/ConsolePanel';
import styles from './App.module.css';

// ── Extended default auth shape — one namespace per auth type ──────────────

const DEFAULT_AUTH = {
  type: 'none',
  bearer:    { token: '' },
  basic:     { username: '', password: '' },
  apikey:    { key: '', value: '', in: 'header' },
  oauth2: {
    grantType: 'client_credentials',
    authUrl: '', tokenUrl: '', clientId: '', clientSecret: '',
    scope: '', state: '', redirectUri: '',
    username: '', password: '',
    tokenName: 'My Token', currentToken: null,
  },
  digest:   { username: '', password: '', realm: '', nonce: '', algorithm: 'MD5' },
  ntlm:     { username: '', password: '', domain: '', workstation: '' },
  awssigv4: { accessKey: '', secretKey: '', region: 'us-east-1', service: '', sessionToken: '' },
  hawk:     { hawkId: '', hawkKey: '', algorithm: 'sha256' },
  edgegrid: { clientToken: '', clientSecret: '', accessToken: '', baseUri: '' },
};

const DEFAULT_REQUEST = {
  id: null, name: '',
  method: 'GET', url: '',
  params: [], headers: [],
  body: { type: 'none', content: '', fields: [] },
  auth: DEFAULT_AUTH,
};

// Merge saved auth (may be old flat format or new nested) with defaults
function mergeAuth(saved = {}) {
  if (!saved || typeof saved !== 'object') return DEFAULT_AUTH;
  return {
    ...DEFAULT_AUTH,
    ...saved,
    // Backwards compat: migrate flat bearer/basic/apikey fields
    bearer:    saved.bearer    || { token: saved.token || '' },
    basic:     saved.basic     || { username: saved.username || '', password: saved.password || '' },
    apikey:    saved.apikey    || { key: saved.key || '', value: saved.value || '', in: saved.in || 'header' },
    oauth2:    { ...DEFAULT_AUTH.oauth2,   ...(saved.oauth2   || {}) },
    digest:    { ...DEFAULT_AUTH.digest,   ...(saved.digest   || {}) },
    ntlm:      { ...DEFAULT_AUTH.ntlm,     ...(saved.ntlm     || {}) },
    awssigv4:  { ...DEFAULT_AUTH.awssigv4, ...(saved.awssigv4 || {}) },
    hawk:      { ...DEFAULT_AUTH.hawk,     ...(saved.hawk     || {}) },
    edgegrid:  { ...DEFAULT_AUTH.edgegrid, ...(saved.edgegrid || {}) },
  };
}

function AppInner() {
  const { send, loading, response } = useRequest();
  const { addEntry } = useHistory();
  const { environments, activeEnvId, activeVariables, setActiveEnvironment } = useEnvironment();

  const [currentRequest, setCurrentRequest] = useState(DEFAULT_REQUEST);
  const [sidebarTab,     setSidebarTab]     = useState('collections');
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showImporter,   setShowImporter]   = useState(false);
  const [showSaveModal,  setShowSaveModal]  = useState(false);

  const handleSend = useCallback(async () => {
    if (!currentRequest.url.trim()) return;
    const result = await send(currentRequest, activeVariables);
    if (result) {
      await addEntry({
        id: uuidv4(), timestamp: Date.now(),
        method: currentRequest.method, url: currentRequest.url,
        params: currentRequest.params, headers: currentRequest.headers,
        body: currentRequest.body, auth: currentRequest.auth,
        status: result.status, statusText: result.statusText,
        responseTime: result.time,
      });
    }
  }, [currentRequest, activeVariables, send, addEntry]);

  const handleLoadRequest = useCallback((req) => {
    setCurrentRequest({
      id:      req.id      || null,
      name:    req.name    || '',
      method:  req.method  || 'GET',
      url:     req.url     || '',
      params:  req.params  || [],
      headers: req.headers || [],
      body:    req.body    || { type: 'none', content: '', fields: [] },
      auth:    mergeAuth(req.auth),
    });
  }, []);

  const activeEnvName = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    return env?.name || 'No Environment';
  }, [environments, activeEnvId]);

  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoBadge}>
            <img src="/logo.png" alt="DevNexus" className={styles.logoImg} />
          </div>
          <div className={styles.brandText}>
            <p className={styles.brandTitle}>
              <span className={styles.brandAccent}>DevNexus</span>
              <span className={styles.brandSep}>&nbsp;—&nbsp;</span>
              <span className={styles.brandTool}>REST Client</span>
            </p>
            <p className={styles.brandSub}>Client-side · No data leaves your browser</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.envSelector}>
            <select
              className={styles.envSelect}
              value={activeEnvId || ''}
              onChange={(e) => setActiveEnvironment(e.target.value || null)}
            >
              <option value="">No Environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
            <button className={styles.envManageBtn} onClick={() => setShowEnvManager(true)} title="Manage environments">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Manage
            </button>
          </div>
        </div>

        <div className={styles.headerRight}>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Body (sidebar + main) ── */}
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTabs}>
            <button className={`${styles.sidebarTab} ${sidebarTab === 'collections' ? styles.activeSidebarTab : ''}`} onClick={() => setSidebarTab('collections')}>
              Collections
            </button>
            <button className={`${styles.sidebarTab} ${sidebarTab === 'history' ? styles.activeSidebarTab : ''}`} onClick={() => setSidebarTab('history')}>
              History
            </button>
          </div>
          <div className={styles.sidebarContent}>
            {sidebarTab === 'collections' && (
              <CollectionsSidebar onLoadRequest={handleLoadRequest} onOpenImport={() => setShowImporter(true)} />
            )}
            {sidebarTab === 'history' && (
              <HistoryPanel onLoadRequest={handleLoadRequest} />
            )}
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.requestArea}>
            <RequestPanel
              request={currentRequest}
              onChange={setCurrentRequest}
              onSend={handleSend}
              onSave={() => setShowSaveModal(true)}
              loading={loading}
            />
          </div>
          <div className={styles.responseArea}>
            <ResponsePanel response={response} />
          </div>
        </main>
      </div>

      {/* ── Console Panel ── */}
      <ConsolePanel />

      {/* ── Modals ── */}
      {showEnvManager && <EnvironmentManager onClose={() => setShowEnvManager(false)} />}
      {showImporter   && <PostmanImporter    onClose={() => setShowImporter(false)}   />}
      {showSaveModal  && <SaveRequestModal   request={currentRequest} onClose={() => setShowSaveModal(false)} />}

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <EnvironmentProvider>
        <AppInner />
      </EnvironmentProvider>
    </ThemeProvider>
  );
}
