import { createContext, useContext, type ReactNode } from 'react';
import { useVendas } from '../hooks/useVendas';

type Valor = ReturnType<typeof useVendas>;
const Ctx = createContext<Valor | null>(null);

export function VendasProvider({ children }: { children: ReactNode }) {
  const valor = useVendas();
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useVendasCtx(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVendasCtx fora do provider');
  return v;
}
