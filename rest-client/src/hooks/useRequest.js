import { useState, useCallback } from 'react';
import { executeRequest } from '../api/client';

export function useRequest() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const send = useCallback(async (requestConfig, variables = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await executeRequest(requestConfig, variables);
      setResponse(result);
      return result;
    } catch (err) {
      const errResult = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: err.message,
        time: 0,
        size: 0,
        isError: true,
      };
      setResponse(errResult);
      setError(err.message);
      return errResult;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { send, loading, response, error, clearResponse };
}
