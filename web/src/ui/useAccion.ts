import { useCallback } from 'react';
import { errMsg } from '@/lib';
import { toast } from './feedback';

/** Ejecuta una acción de la API: avisa el resultado con un toast y recarga la lista. */
export function useAccion(reload: () => void) {
  return useCallback(
    async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
      try {
        await fn();
        if (ok) toast.ok(ok);
        reload();
        return true;
      } catch (x) {
        toast.error(errMsg(x));
        return false;
      }
    },
    [reload],
  );
}
