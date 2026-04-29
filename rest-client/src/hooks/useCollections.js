import { useState, useEffect, useCallback } from 'react';
import {
  getCollections,
  saveCollection,
  deleteCollection,
} from '../db/collections';
import { v4 as uuidv4 } from 'uuid';

export function useCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollections().then((c) => {
      setCollections(c);
      setLoading(false);
    });
  }, []);

  const createCollection = useCallback(async (name) => {
    const col = { id: uuidv4(), name, requests: [] };
    await saveCollection(col);
    setCollections((prev) => [...prev, col]);
    return col;
  }, []);

  const renameCollection = useCallback(async (id, name) => {
    setCollections((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, name } : c));
      const col = updated.find((c) => c.id === id);
      if (col) saveCollection(col);
      return updated;
    });
  }, []);

  const removeCollection = useCallback(async (id) => {
    await deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveRequest = useCallback(async (collectionId, request) => {
    setCollections((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== collectionId) return c;
        const exists = c.requests.find((r) => r.id === request.id);
        const requests = exists
          ? c.requests.map((r) => (r.id === request.id ? request : r))
          : [...c.requests, request];
        return { ...c, requests };
      });
      const col = updated.find((c) => c.id === collectionId);
      if (col) saveCollection(col);
      return updated;
    });
  }, []);

  const deleteRequest = useCallback(async (collectionId, requestId) => {
    setCollections((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== collectionId) return c;
        return { ...c, requests: c.requests.filter((r) => r.id !== requestId) };
      });
      const col = updated.find((c) => c.id === collectionId);
      if (col) saveCollection(col);
      return updated;
    });
  }, []);

  const importCollection = useCallback(async (collection) => {
    await saveCollection(collection);
    setCollections((prev) => {
      const exists = prev.find((c) => c.id === collection.id);
      return exists
        ? prev.map((c) => (c.id === collection.id ? collection : c))
        : [...prev, collection];
    });
  }, []);

  return {
    collections,
    loading,
    createCollection,
    renameCollection,
    removeCollection,
    saveRequest,
    deleteRequest,
    importCollection,
  };
}
