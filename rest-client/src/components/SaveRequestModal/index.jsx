import { useState, useCallback } from 'react';
import { useCollections } from '../../hooks/useCollections';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import styles from './styles.module.css';

export function SaveRequestModal({ request, onClose }) {
  const { collections, createCollection, saveRequest } = useCollections();
  const [name, setName] = useState(request?.name || '');
  const [selectedColId, setSelectedColId] = useState(collections[0]?.id || '');
  const [newColName, setNewColName] = useState('');
  const [creatingCol, setCreatingCol] = useState(collections.length === 0);

  const handleSave = useCallback(async () => {
    const reqName = name.trim() || `${request?.method} ${request?.url}`;

    let colId = selectedColId;
    if (creatingCol) {
      const colName = newColName.trim();
      if (!colName) { toast.error('Enter a collection name'); return; }
      const col = await createCollection(colName);
      colId = col.id;
    }

    if (!colId) { toast.error('Select or create a collection'); return; }

    await saveRequest(colId, {
      ...request,
      id: request.id || uuidv4(),
      name: reqName,
    });

    toast.success(`Saved "${reqName}" to collection.`);
    onClose();
  }, [name, newColName, selectedColId, creatingCol, request, createCollection, saveRequest, onClose]);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Save Request</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Request Name</label>
            <input
              autoFocus
              className={styles.input}
              placeholder={`${request?.method} ${request?.url || 'Untitled'}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Collection</label>
            {collections.length > 0 && (
              <div className={styles.colTabs}>
                <button
                  className={`${styles.colTab} ${!creatingCol ? styles.activeColTab : ''}`}
                  onClick={() => setCreatingCol(false)}
                >
                  Existing
                </button>
                <button
                  className={`${styles.colTab} ${creatingCol ? styles.activeColTab : ''}`}
                  onClick={() => setCreatingCol(true)}
                >
                  New Collection
                </button>
              </div>
            )}

            {!creatingCol && collections.length > 0 ? (
              <select
                className={styles.select}
                value={selectedColId}
                onChange={(e) => setSelectedColId(e.target.value)}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                placeholder="New collection name..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
