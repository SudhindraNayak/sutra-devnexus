import { useContext } from 'react';
import { EnvironmentContext } from '../context/EnvironmentContext';

export function useEnvironment() {
  return useContext(EnvironmentContext);
}
