import { useMemo, useState } from 'react';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { SEGMENTOS, derivarOportunidades, derivarReativacao } from '../lib/domain';
import { moeda } from '../lib/format';

/**
 * A planilha não possui campo de etapa (Confirmação/OS/Data estão vazios) e
 * C/N indica tipo de cliente (C = base, N = novo) — por isso o Kanban agrupa
 * por segmento em modo leitura, sem mover cards entre colunas.
 */
export default function Oportunidades() {
  const { vendas, carregando, erro, recarregar } = useVendasCtx();
  const [busca, setBusca] = useState('');
  const [filtroRPI, setFiltroRPI] = useState('');
  const [ordemRea, setOrdemRea] = useState<'antigos' | 'recentes' | 'valor'>('antigos');

  const todas = useMemo(() => derivarOportunidades(vendas), [vendas]);
  const rpis = useMemo(() => [...new Set(todas.map((o) => o.rpi).filter(Boolean))].sort(), [todas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todas.filter((o) => {
      if (filtroRPI && o.rpi !== filtroRPI) return false;
      if (!q) return true;
      return o.titulo.toLowerCase().includes(q) || o.numeroPedido.toLowerCase().includes(q) || o.uf.toLowerCase().includes(q);
    });
  }, [todas, busca, filtroRPI]);

  /** Clientes sem compra há 60 dias ou mais — coluna Reativação (um card por cliente). */
  const reativacao = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const lista = derivarReativacao(vendas).filter((c) => {
      if (filtroRPI && c.vendedor !== filtroRPI) return false;
      if (!q) return true;
      const cn = c.cnpj.replace(/\D/g, '');
      return c.nome.toLowerCase().includes(q) || c.cnpj.toLowerCase().includes(q) || (qd !== '' && cn.includes(qd));
    });
    if (ordemRea === 'valor') lista.sort((a, b) => b.valorUltima - a.valorUltima);
    else if (ordemRea === 'recentes') lista.sort((a, b) => a.diasSemComprar - b.diasSemComprar);
    else lista.sort((a, b) => b.diasSemComprar - a.diasSemComprar);
    return lista;
  }, [vendas, busca, filtroRPI, ordemRea]);

  if (carregando) return <div className="estado">Carregando oportunidades da API…</div>;
  if (erro)
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Oportunidades (Kanban)</h2>
          <p>
            Primeira coluna: Reativação — clientes sem compra há 60 dias ou mais (nome, CNPJ, último vendedor e valor
            da última compra). Nas demais, cada card é um lançamento real das abas mensais, agrupado por tipo de
            cliente. Sem etapa na planilha: mover cards está desativado. Marcadores
            (bonificação/expositor/cancelado/troca) ficam fora do Kanban.
          </p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="barra">
        <input
          className="busca"
          placeholder="Buscar cliente, pedido ou UF…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select value={filtroRPI} onChange={(e) => setFiltroRPI(e.target.value)}>
          <option value="">Todos os RPIs</option>
          {rpis.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={ordemRea}
          onChange={(e) => setOrdemRea(e.target.value as 'antigos' | 'recentes' | 'valor')}
          title="Ordenação da coluna Reativação"
        >
          <option value="antigos">Reativação: mais antigos primeiro</option>
          <option value="recentes">Reativação: mais recentes primeiro</option>
          <option value="valor">Reativação: maior valor</option>
        </select>
      </div>

      <div className="kanban">
        <div className="coluna">
          <h4>Reativação</h4>
          <div className="cont">
            {reativacao.length} clientes • sem compra há 60 dias ou mais •{' '}
            {ordemRea === 'valor' ? 'maior valor da última compra' : ordemRea === 'recentes' ? 'mais recentes primeiro' : 'mais antigos primeiro'}
          </div>
          {reativacao.slice(0, 60).map((c) => (
            <div key={c.id} className="cartao">
              <strong>{c.nome || '—'}</strong>
              <div className="meta">CNPJ {c.cnpj || '—'}</div>
              <div className="meta">Último vendedor: {c.vendedor || 'sem RPI'}</div>
              <div className="meta">
                Última compra: {c.ultimaCompra.split('-').reverse().join('/')} • {c.diasSemComprar} dias
              </div>
              <div className="valor">{moeda(c.valorUltima)}</div>
            </div>
          ))}
          {reativacao.length > 60 && <div className="meta">Mostrando 60 de {reativacao.length} — refine a busca.</div>}
          {reativacao.length === 0 && <div className="meta">Nenhum cliente sem compra há 60 dias ou mais.</div>}
        </div>

        {SEGMENTOS.map((seg) => {
          const cards = filtradas.filter((o) => o.segmento === seg.id);
          const total = cards.filter((c) => !c.cancelada).reduce((s, c) => s + c.valor, 0);
          return (
            <div key={seg.id} className="coluna">
              <h4>{seg.titulo}</h4>
              <div className="cont">
                {cards.length} cards • {moeda(total)} • {seg.descricao}
              </div>
              {cards.slice(0, 60).map((o, idx) => (
                <div key={`${o.id}-${idx}`} className="cartao">
                  <strong>{o.titulo || '—'}</strong>
                  <div className="meta">
                    {o.numeroPedido ? `Ped. ${o.numeroPedido} • ` : ''}{o.uf || '—'} • {o.rpi || 'sem RPI'} • linha {o.id}
                    {o.cancelada ? ' • CANCELADO' : ''}
                  </div>
                  <div className="valor">{moeda(o.valor)}</div>
                </div>
              ))}
              {cards.length > 60 && <div className="meta">Mostrando 60 de {cards.length} — refine a busca.</div>}
              {cards.length === 0 && <div className="meta">Nenhum card neste segmento.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
