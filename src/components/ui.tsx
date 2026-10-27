import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

/** Tons suaves usados nos ícones dos cards (cor do ícone + fundo claro). */
export type Tom = 'vermelho' | 'azul' | 'roxo' | 'verde' | 'ambar' | 'ciano' | 'laranja' | 'rosa';

/**
 * Card de indicador. Componente puramente visual: recebe textos já formatados.
 * Estrutura: título (esquerda) + ícone (direita), valor e descrição.
 */
export function Card({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = 'azul',
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone?: ReactNode;
  tom?: Tom;
}) {
  return (
    <div className="card">
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
