import { useState, useCallback } from 'react';
import { useEnvironment } from '../../hooks/useEnvironment';
import { v4 as uuidv4 } from 'uuid';
import styles from './styles.module.css';

export function EnvironmentManager({ onClose }) {
  const {
    environments,
    activeEnvId,
    setActiveEnvironment,
    createEnvironment,
    updateEnvironment,
    removeEnvironment,
  } = useEnvironment();

  const [selectedId, setSelectedId] = useState(environments[0]?.id || null);
  const [newEnvName, setNewEnvName] = useState('');
  const [addingEnv, setAddingEnv] = useState(false);

  const selected = environments.find((e) => e.id === selectedId);

  const handleCreate = useCallback(async () => {
    const name = newEnvName.trim();
    if (!name) return;
    const env = await createEnvironment(name);
    setSelectedId(env.id);
    setNewEnvName('');
    setAddingEnv(false);
  }, [newEnvName, createEnvironment]);

  const handleAddVariable = useCallback(() => {
    if (!selected) return;
    updateEnvironment({
      ...selected,
      variables: [...(selected.variables || []), { key: '', value: '', enabled: true }],
    });
  }, [selected, updateEnvironment]);

  const handleUpdateVariable = useCallback(
    (index, field, val) => {
      if (!selected) return;
      const variables = selected.variables.map((v, i) =>
        i === index ? { ...v, [field]: val } : v
      );
      updateEnvironment({ ...selected, variables });
    },
    [selected, updateEnvironment]
  );

  const handleRemoveVariable = useCallback(
    (index) => {
      if (!selected) return;
      updateEnvironment({
        ...selected,
        variables: selected.variables.filter((_, i) => i !== index),
      });
    },
    [selected, updateEnvironment]
  );

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Environments</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.envList}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>Environments</span>
              <button className={styles.addEnvBtn} onClick={() => setAddingEnv(true)} title="New environment">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {addingEnv && (
              <div className={styles.newEnvForm}>
                <input
                  autoFocus
                  className={styles.nameInput}
                  placeholder="Environment name..."
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAddingEnv(false); }}
                />
                <button className={styles.confirmBtn} onClick={handleCreate}>Add</button>
              </div>
            )}

            {environments.map((env) => (
              <div
                key={env.id}
                className={`${styles.envItem} ${selectedId === env.id ? styles.selected : ''}`}
                onClick={() => setSelectedId(env.id)}
              >
                <div className={styles.envItemLeft}>
                  <input
                    type="radio"
                    checked={activeEnvId === env.id}
                    onChange={() => setActiveEnvironment(env.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeEnvId === env.id) setActiveEnvironment(null);
                    }}
                    title="Set as active"
                    aria-label="Set as active environment"
                  />
                  <span className={styles.envName}>{env.name}</span>
                  {activeEnvId === env.id && <span className={styles.activeBadge}>Active</span>}
                </div>
                <button
                  className={styles.deleteEnvBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEnvironment(env.id);
                    if (selectedId === env.id) setSelectedId(null);
                  }}
                  title="Delete environment"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}

            {environments.length === 0 && !addingEnv && (
              <div className={styles.emptyList}>No environments. Click + to create one.</div>
            )}
          </div>

          <div className={styles.varEditor}>
            {!selected ? (
              <div className={styles.noEnvSelected}>Select or create an environment to manage variables.</div>
            ) : (
              <>
                <div className={styles.varHeader}>
                  <span className={styles.varTitle}>{selected.name} — Variables</span>
                </div>
                <div className={styles.varTableHeader}>
                  <span />
                  <span>Variable</span>
                  <span>Value</span>
                  <span />
                </div>
                <div className={styles.varRows}>
                  {selected.variables?.map((v, i) => (
                    <div key={i} className={styles.varRow}>
                      <input
                        type="checkbox"
                        checked={v.enabled}
                        onChange={(e) => handleUpdateVariable(i, 'enabled', e.target.checked)}
                        aria-label="Enable"
                      />
                      <input
                        className={styles.varInput}
                        placeholder="VARIABLE_NAME"
                        value={v.key}
                        onChange={(e) => handleUpdateVariable(i, 'key', e.target.value)}
                        spellCheck={false}
                      />
                      <input
                        className={styles.varInput}
                        placeholder="value"
                        value={v.value}
                        onChange={(e) => handleUpdateVariable(i, 'value', e.target.value)}
                        spellCheck={false}
                      />
                      <button className={styles.removeVarBtn} onClick={() => handleRemoveVariable(i)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button className={styles.addVarBtn} onClick={handleAddVariable}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Variable
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
