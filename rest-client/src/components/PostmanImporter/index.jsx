import { useState, useCallback, useRef } from 'react';
import { useCollections } from '../../hooks/useCollections';
import { useEnvironment } from '../../hooks/useEnvironment';
import { parsePostmanFile } from '../../utils/postmanImporter';
import toast from 'react-hot-toast';
import styles from './styles.module.css';

export function PostmanImporter({ onClose }) {
  const { importCollection } = useCollections();
  const { importEnvironment } = useEnvironment();
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const processFile = useCallback(
    async (file) => {
      if (!file || !file.name.endsWith('.json')) {
        setError('Only JSON files are supported.');
        return;
      }
      setError(null);
      setResult(null);
      setImporting(true);
      try {
        const text = await file.text();
        const parsed = parsePostmanFile(text);
        setResult({ ...parsed, fileName: file.name });
      } catch (err) {
        setError(err.message);
      } finally {
        setImporting(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleImport = useCallback(async () => {
    if (!result) return;
    try {
      if (result.type === 'collection') {
        await importCollection(result.collection);
        toast.success(`Imported "${result.collection.name}" with ${result.requestCount} request(s).`);
      } else if (result.type === 'environment') {
        await importEnvironment(result.environment);
        toast.success(`Imported environment "${result.environment.name}" with ${result.variableCount} variable(s).`);
      }
      onClose();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    }
  }, [result, importCollection, importEnvironment, onClose]);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import from Postman</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.desc}>
            Supports Postman Collection v2.0 / v2.1 and Environment exports.
          </p>

          <div
            className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>Drag & drop a JSON file here</p>
            <span>or click to browse</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </div>

          {importing && <div className={styles.status}>Parsing file...</div>}

          {error && (
            <div className={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {result && !error && (
            <div className={styles.resultBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <strong>
                  {result.type === 'collection'
                    ? `Collection: "${result.collection.name}"`
                    : `Environment: "${result.environment.name}"`}
                </strong>
                <span className={styles.resultDetail}>
                  {result.type === 'collection'
                    ? `${result.requestCount} request(s) · Format: ${result.format}`
                    : `${result.variableCount} variable(s)`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.importBtn}
            onClick={handleImport}
            disabled={!result || importing}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
