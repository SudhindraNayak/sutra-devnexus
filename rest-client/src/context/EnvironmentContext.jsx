import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, saveSettings } from '../db/settings';
import {
  getEnvironments,
  saveEnvironment as saveEnvToDB,
  deleteEnvironment as deleteEnvFromDB,
} from '../db/environments';
import { v4 as uuidv4 } from 'uuid';

export const EnvironmentContext = createContext();

export function EnvironmentProvider({ children }) {
  const [environments, setEnvironments] = useState([]);
  const [activeEnvId, setActiveEnvId] = useState(null);

  useEffect(() => {
    Promise.all([getEnvironments(), getSettings()]).then(([envs, settings]) => {
      setEnvironments(envs);
      setActiveEnvId(settings.activeEnvironmentId || null);
    });
  }, []);

  const activeVariables = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    if (!env) return {};
    return env.variables.reduce((acc, v) => {
      if (v.enabled && v.key) acc[v.key] = v.value;
      return acc;
    }, {});
  }, [environments, activeEnvId]);

  const setActiveEnvironment = useCallback(async (id) => {
    setActiveEnvId(id);
    await saveSettings({ activeEnvironmentId: id });
  }, []);

  const createEnvironment = useCallback(async (name) => {
    const env = { id: uuidv4(), name, variables: [] };
    await saveEnvToDB(env);
    setEnvironments((prev) => [...prev, env]);
    return env;
  }, []);

  const updateEnvironment = useCallback(async (env) => {
    await saveEnvToDB(env);
    setEnvironments((prev) => prev.map((e) => (e.id === env.id ? env : e)));
  }, []);

  const removeEnvironment = useCallback(
    async (id) => {
      await deleteEnvFromDB(id);
      setEnvironments((prev) => prev.filter((e) => e.id !== id));
      if (activeEnvId === id) {
        setActiveEnvId(null);
        await saveSettings({ activeEnvironmentId: null });
      }
    },
    [activeEnvId]
  );

  const importEnvironment = useCallback(async (env) => {
    await saveEnvToDB(env);
    setEnvironments((prev) => {
      const exists = prev.find((e) => e.id === env.id);
      return exists ? prev.map((e) => (e.id === env.id ? env : e)) : [...prev, env];
    });
  }, []);

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        activeEnvId,
        activeVariables,
        setActiveEnvironment,
        createEnvironment,
        updateEnvironment,
        removeEnvironment,
        importEnvironment,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}
