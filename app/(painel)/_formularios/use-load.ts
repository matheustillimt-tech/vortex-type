"use client";

import { useEffect, useState } from "react";

/** Carrega dados e recarrega quando alguma dependência muda. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => ativo && setData(d))
      .catch((e) => ativo && setError(e))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, error, loading };
}
