import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

/** Tons semânticos para ícones dos cards (cor do ícone + fundo tonal). */
export type Tom = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange' | 'pink';

/**
 * Card de indicador (métrica). Componente puramente visual: recebe textos já formatados.
 * Estrutura: título (esquerda) + ícone (direita), valor e descrição.
 * Usa classe .metric para accent bar lateral.
 */
export function Card({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = 'brand',
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone?: ReactNode;
  tom?: Tom;
}) {
  return (
    <div className="card metric">
      <div className="card-topo">
        <div className="rotulo">{rotulo}</div>
        {icone && <div className={`card-icone ic-${tom}`}>{icone}</div>}
      </div>
      <div className="valor">{valor}</div>
      <div className="detalhe">{detalhe}</div>
    </div>
  );
}

/** Botão de recarregar dados da API (mesmo comportamento, aparência padronizada). */
export function BotaoAtualizar({ aoAtualizar }: { aoAtualizar: () => void }) {
  return (
    <button onClick={aoAtualizar} title="Recarregar os dados da planilha mestre">
      <RefreshCw />
      Atualizar
    </button>
  );
}
