import { useState, useCallback } from 'react';
import { useCollections } from '../../hooks/useCollections';
import styles from './styles.module.css';

const METHOD_COLORS = {
  GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch',
  DELETE: 'delete', HEAD: 'head', OPTIONS: 'options',
};

export function CollectionsSidebar({ onLoadRequest, onOpenImport }) {
  const { collections, loading, createCollection, renameCollection, removeCollection, deleteRequest } = useCollections();
  const [expanded, setExpanded] = useState({});
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCreate = useCallback(async () => {
    const name = newColName.trim();
    if (!name) return;
    const col = await createCollection(name);
    setExpanded((prev) => ({ ...prev, [col.id]: true }));
    setNewColName('');
    setAddingCol(false);
  }, [newColName, createCollection]);

  const handleRename = useCallback(async (id) => {
    const name = renameVal.trim();
    if (name) await renameCollection(id, name);
    setRenamingId(null);
  }, [renameVal, renameCollection]);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>Collections</span>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => setAddingCol(true)} title="New collection">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={onOpenImport} title="Import Postman">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {addingCol && (
        <div className={styles.newColForm}>
          <input
            autoFocus
            className={styles.inlineInput}
            placeholder="Collection name..."
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAddingCol(false); }}
          />
          <button className={styles.confirmBtn} onClick={handleCreate}>Add</button>
          <button className={styles.cancelBtn} onClick={() => setAddingCol(false)}>Cancel</button>
        </div>
      )}

      <div className={styles.list}>
        {collections.length === 0 && !addingCol && (
          <div className={styles.empty}>
            <p>No collections yet.</p>
            <p>Create one or import from Postman.</p>
          </div>
        )}

        {collections.map((col) => (
          <div key={col.id} className={styles.collection}>
            <div className={styles.colHeader}>
              <button className={styles.expandBtn} onClick={() => toggleExpand(col.id)}>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                  style={{ transform: expanded[col.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {renamingId === col.id ? (
                <input
                  autoFocus
                  className={styles.inlineInput}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(col.id); if (e.key === 'Escape') setRenamingId(null); }}
                  onBlur={() => handleRename(col.id)}
                />
              ) : (
                <span
                  className={styles.colName}
                  onDoubleClick={() => { setRenamingId(col.id); setRenameVal(col.name); }}
                  title={col.name}
                >
                  {col.name}
                </span>
              )}
              <span className={styles.colCount}>{col.requests?.length || 0}</span>
              <button
                className={styles.deleteBtn}
                onClick={() => removeCollection(col.id)}
                title="Delete collection"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>

            {expanded[col.id] && (
              <div className={styles.requests}>
                {col.requests?.length === 0 && (
                  <div className={styles.noRequests}>No saved requests.</div>
                )}
                {col.requests?.map((req) => (
                  <div key={req.id} className={styles.requestRow} onClick={() => onLoadRequest(req)}>
                    <span className={`${styles.methodBadge} ${styles[METHOD_COLORS[req.method] || 'get']}`}>
                      {req.method}
                    </span>
                    <span className={styles.reqName} title={req.name}>{req.name}</span>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); deleteRequest(col.id, req.id); }}
                      title="Delete request"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
