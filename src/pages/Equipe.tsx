import { useMemo } from 'react';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { derivarEquipe } from '../lib/domain';
import { moeda, numero } from '../lib/format';

export default function Equipe() {
  const { vendas, carregando, erro, recarregar, total } = useVendasCtx();
  const equipe = useMemo(() => derivarEquipe(vendas), [vendas]);
  const rpis = equipe.filter((m) => m.origem === 'RPI');
  const resp = equipe.filter((m) => m.origem === 'RESP.');

  if (carregando) return <div className="estado">Carregando equipe da API…</div>;
  if (erro)
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  const Bloco = ({ titulo, lista }: { titulo: string; lista: typeof equipe }) => (
    <div className="painel">
      <h3>{titulo}</h3>
      <p className="sub">
        {lista.length} pessoas reais encontradas em {total} lançamentos das abas mensais.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cód. vendedor</th>
            <th className="direita">Pedidos</th>
            <th className="direita">Receita</th>
            <th className="direita">UFs</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((m) => (
            <tr key={`${m.origem}-${m.nome}`}>
              <td>{m.nome}</td>
              <td>{m.codigoVendedor || '—'}</td>
              <td className="direita">{numero(m.pedidos)}</td>
              <td className="direita">{moeda(m.receita)}</td>
              <td className="direita">{numero(m.ufs)}</td>
            </tr>
          ))}
          {lista.length === 0 && (
            <tr>
              <td colSpan={5} className="vazio">
                Nenhum registro com este campo na API.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Equipe</h2>
          <p>Equipe derivada do campo real “RPI” — sem cadastros fictícios.</p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>
      <Bloco titulo="Representantes (RPI)" lista={rpis} />
      <Bloco titulo="Responsáveis (RESP.)" lista={resp} />
    </div>
  );
}
