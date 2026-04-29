import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import styles from './styles.module.css';

export function KeyValueEditor({ items = [], onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  const updateItem = useCallback(
    (id, field, value) => {
      onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    },
    [items, onChange]
  );

  const addItem = useCallback(() => {
    onChange([...items, { id: uuidv4(), key: '', value: '', enabled: true }]);
  }, [items, onChange]);

  const removeItem = useCallback(
    (id) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange]
  );

  return (
    <div className={styles.editor}>
      {items.length > 0 && (
        <div className={styles.header}>
          <span className={styles.colCheck} />
          <span className={styles.colKey}>{keyPlaceholder}</span>
          <span className={styles.colValue}>{valuePlaceholder}</span>
          <span className={styles.colAction} />
        </div>
      )}
      <div className={styles.rows}>
        {items.map((item) => (
          <div key={item.id} className={styles.row}>
            <input
              type="checkbox"
              className={styles.check}
              checked={item.enabled}
              onChange={(e) => updateItem(item.id, 'enabled', e.target.checked)}
              aria-label="Enable"
            />
            <input
              className={styles.input}
              placeholder={keyPlaceholder}
              value={item.key}
              onChange={(e) => updateItem(item.id, 'key', e.target.value)}
              spellCheck={false}
            />
            <input
              className={styles.input}
              placeholder={valuePlaceholder}
              value={item.value}
              onChange={(e) => updateItem(item.id, 'value', e.target.value)}
              spellCheck={false}
            />
            <button className={styles.removeBtn} onClick={() => removeItem(item.id)} title="Remove" aria-label="Remove row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button className={styles.addBtn} onClick={addItem}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add {keyPlaceholder}
      </button>
    </div>
  );
}
