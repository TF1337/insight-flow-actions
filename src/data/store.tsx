import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Action, Observation } from "./types";
import { MOCK_ACTIONS, MOCK_OBSERVATIONS } from "./mock";

type Store = {
  observations: Observation[];
  actions: Action[];
  upsertAction: (a: Action) => void;
  upsertObservation: (o: Observation) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [observations, setObservations] = useState<Observation[]>(MOCK_OBSERVATIONS);
  const [actions, setActions] = useState<Action[]>(MOCK_ACTIONS);

  const value = useMemo<Store>(
    () => ({
      observations,
      actions,
      upsertAction: (a) =>
        setActions((s) => (s.some((x) => x.id === a.id) ? s.map((x) => (x.id === a.id ? a : x)) : [a, ...s])),
      upsertObservation: (o) =>
        setObservations((s) => (s.some((x) => x.id === o.id) ? s.map((x) => (x.id === o.id ? o : x)) : [o, ...s])),
    }),
    [observations, actions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useApp buiten StoreProvider");
  return ctx;
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
