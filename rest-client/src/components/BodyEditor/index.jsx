import { useState, useCallback } from 'react';
import { KeyValueEditor } from '../KeyValueEditor';
import { validateJson } from '../../utils/validators';
import styles from './styles.module.css';

const BODY_TYPES = ['none', 'json', 'form', 'raw'];

export function BodyEditor({ body, onChange }) {
  const [jsonError, setJsonError] = useState(null);

  const setType = useCallback(
    (type) => {
      onChange({ ...body, type });
      setJsonError(null);
    },
    [body, onChange]
  );

  const setContent = useCallback(
    (content) => {
      onChange({ ...body, content });
      if (body.type === 'json') {
        const { error } = validateJson(content);
        setJsonError(error);
      }
    },
    [body, onChange]
  );

  const setFields = useCallback(
    (fields) => {
      onChange({ ...body, fields });
    },
    [body, onChange]
  );

  return (
    <div className={styles.editor}>
      <div className={styles.typeBar}>
        {BODY_TYPES.map((t) => (
          <button
            key={t}
            className={`${styles.typeBtn} ${body.type === t ? styles.active : ''}`}
            onClick={() => setType(t)}
          >
            {t === 'none' ? 'None' : t === 'json' ? 'JSON' : t === 'form' ? 'Form Data' : 'Raw'}
          </button>
        ))}
      </div>

      {body.type === 'none' && (
        <div className={styles.empty}>
          <p>No body — select a body type above to add a request body.</p>
        </div>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div className={styles.textareaWrap}>
          <textarea
            className={`${styles.textarea} ${jsonError ? styles.error : ''}`}
            value={body.content || ''}
            onChange={(e) => setContent(e.target.value)}
            placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body...'}
            spellCheck={false}
          />
          {jsonError && <div className={styles.errorMsg}>{jsonError}</div>}
          {body.type === 'json' && !jsonError && body.content && (
            <div className={styles.validMsg}>Valid JSON</div>
          )}
        </div>
      )}

      {body.type === 'form' && (
        <div className={styles.formEditor}>
          <KeyValueEditor
            items={body.fields || []}
            onChange={setFields}
            keyPlaceholder="Field"
            valuePlaceholder="Value"
          />
        </div>
      )}
    </div>
  );
}
