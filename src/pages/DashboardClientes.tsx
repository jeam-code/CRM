import { CircleCheck, Receipt, UserRound, UserRoundX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BotaoAtualizar, Card } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { resumirClientesAno } from '../lib/domain';
import { dataCurta, moeda, numero } from '../lib/format';

export default function DashboardClientes() {
  const { vendas, carregando, erro, recarregar } = useVendasCtx();
  const [busca, setBusca] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroRPI, setFiltroRPI] = useState('');
  const [inatividade, setInatividade] = useState('');
  const [ordenacao, setOrdenacao] = useState<'receita' | 'nome' | 'dias' | 'ultima'>('receita');

  const base = useMemo(() => resumirClientesAno(vendas), [vendas]);

  const ufs = useMemo(() => [...new Set(base.map((c) => c.uf).filter(Boolean))].sort(), [base]);
  const rpis = useMemo(() => [...new Set(base.map((c) => c.rpi).filter(Boolean))].sort(), [base]);

  const ativos60 = base.filter((c) => c.diasSemComprar !== null && c.diasSemComprar <= 60).length;
  const inativos90 = base.filter((c) => c.diasSemComprar === null || c.diasSemComprar > 90).length;
  const receitaTotal = base.reduce((s, c) => s + c.receita, 0);

  const top = useMemo(() => {
    const lista = [...base];
    if (ordenacao === 'nome') lista.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (ordenacao === 'receita') lista.sort((a, b) => b.receita - a.receita);
    else if (ordenacao === 'ultima') {
      lista.sort((a, b) => {
        const da = new Date(a.ultimaCompra || 0).getTime();
        const db = new Date(b.ultimaCompra || 0).getTime();
        return db - da;
      });
    } else {
      lista.sort((a, b) => b.receita - a.receita);
    }
    return lista.slice(0, 15);
  }, [base, ordenacao]);

  const inativos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const limite = inatividade === '' ? -1 : Number(inatividade);
    let lista = base
      .filter((c) => {
        if (filtroUF && c.uf !== filtroUF) return false;
        if (filtroRPI && c.rpi !== filtroRPI) return false;
        if (limite >= 0 && !(c.diasSemComprar === null || c.diasSemComprar >= limite)) return false;
        if (!q) return true;
        return c.nome.toLowerCase().includes(q) || c.cnpj.toLowerCase().includes(q);
      });
    if (ordenacao === 'nome') lista.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (ordenacao === 'dias') lista.sort((a, b) => (b.diasSemComprar ?? 99999) - (a.diasSemComprar ?? 99999));
    else if (ordenacao === 'ultima') {
      lista.sort((a, b) => {
        const da = new Date(a.ultimaCompra || 0).getTime();
        const db = new Date(b.ultimaCompra || 0).getTime();
        return db - da;
      });
    } else {
      lista.sort((a, b) => (b.diasSemComprar ?? 99999) - (a.diasSemComprar ?? 99999));
    }
    return lista;
  }, [base, busca, filtroUF, filtroRPI, inatividade, ordenacao]);

  if (carregando) return <div className="estado">Carregando base de clientes…</div>;
  if (erro)
    return (
      <div className="estado">
        <p>Erro ao carregar: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Dashboard de clientes</h2>
          <p>
            {numero(base.length)} clientes distintos no ano (por CNPJ/nome) • recência pela última Data Lançamento
          </p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="grid-cards">
        <Card
          rotulo="Clientes no ano"
          valor={numero(base.length)}
          detalhe="base atualizada"
          icone={<UserRound />}
          tom="azul"
        />
        <Card
          rotulo="Ativos (60 dias)"
          valor={numero(ativos60)}
          detalhe="compraram nos últimos 60 dias"
          icone={<CircleCheck />}
          tom="verde"
        />
        <Card
          rotulo="Inativos (90+ dias)"
          valor={numero(inativos90)}
          detalhe="prioridade de reativação"
          icone={<UserRoundX />}
          tom="laranja"
        />
        <Card
          rotulo="Ticket por cliente"
          valor={moeda(base.length > 0 ? receitaTotal / base.length : 0)}
          detalhe={`${moeda(receitaTotal)} no ano`}
          icone={<Receipt />}
          tom="roxo"
        />
      </div>

      <div className="painel">
        <h3>Clientes que mais compram (top 15)</h3>
        <p className="sub">Por Valor Líquido somado no ano, só lançamentos contábeis.</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>UF</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Receita</th>
              <th>Última compra</th>
              <th className="direita">Dias sem comprar</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={c.chave}>
                <td>{i + 1}</td>
                <td>{c.nome}</td>
                <td>{c.uf || '—'}</td>
                <td className="direita">{numero(c.pedidos)}</td>
                <td className="direita">{moeda(c.receita)}</td>
                <td>{c.ultimaCompra ? dataCurta(c.ultimaCompra) : '—'}</td>
                <td className="direita">
                  {c.diasSemComprar === null ? (c.soCancelados ? 'só cancelados' : '—') : numero(c.diasSemComprar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="painel">
        <h3>Tempo sem comprar</h3>
        <p className="sub">Lista principal de clientes. Escolha a ordenação na barra abaixo (receita, nome, dias sem comprar ou última compra).</p>
        <div className="barra">
          <input
            className="busca"
            placeholder="Buscar cliente ou CNPJ…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select value={filtroUF} onChange={(e) => setFiltroUF(e.target.value)}>
            <option value="">Todas as UFs</option>
            {ufs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <select value={filtroRPI} onChange={(e) => setFiltroRPI(e.target.value)}>
            <option value="">Todos os RPIs</option>
            {rpis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={inatividade} onChange={(e) => setInatividade(e.target.value)}>
            <option value="">Sem comprar: todos</option>
            <option value="30">30+ dias</option>
            <option value="60">60+ dias</option>
            <option value="90">90+ dias</option>
          </select>
          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as 'receita' | 'nome' | 'dias' | 'ultima')}>
            <option value="receita">Ordenar: Receita (maior p/ menor)</option>
            <option value="nome">Ordenar: Nome (A-Z)</option>
            <option value="dias">Ordenar: Dias sem comprar (maior p/ menor)</option>
            <option value="ultima">Ordenar: Última compra (mais recente)</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>RPI</th>
              <th>Última compra</th>
              <th className="direita">Dias sem comprar</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Receita ano</th>
            </tr>
          </thead>
          <tbody>
            {inativos.slice(0, 200).map((c) => (
              <tr key={c.chave}>
                <td>{c.nome}</td>
                <td>{c.rpi || '—'}</td>
                <td>{c.ultimaCompra ? dataCurta(c.ultimaCompra) : '—'}</td>
                <td className="direita">
                  {c.diasSemComprar === null ? (
                    c.soCancelados ? <span className="pill">só cancelados</span> : <span className="pill">sem data</span>
                  ) : (
                    numero(c.diasSemComprar)
                  )}
                </td>
                <td className="direita">{numero(c.pedidos)}</td>
                <td className="direita">{moeda(c.receita)}</td>
              </tr>
            ))}
            {inativos.length === 0 && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhum cliente para os filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {inativos.length > 200 && <p className="sub">Mostrando 200 de {inativos.length} — refine os filtros.</p>}
      </div>
    </div>
  );
}
