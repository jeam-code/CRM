import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Ban,
  Banknote,
  ClipboardList,
  Clock,
  Gift,
  Receipt,
  Repeat,
  Store,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { BotaoAtualizar, Card } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { matriz } from '../lib/api';
import { MESES, type Mes } from '../lib/config';
import {
  campo,
  dataLancamentoValida,
  ehContabil,
  ehLinhaValida,
  marcador,
  parseResumoGeral,
  topPor,
  type BlocoResumo,
  type ResumoGeral,
  type Venda,
} from '../lib/domain';
import { moeda, numero } from '../lib/format';

function TabelaBloco({ titulo, sub, itens }: { titulo: string; sub: string; itens: BlocoResumo[] }) {
  const tot = itens.reduce(
    (s, i) => ({ qtd: s.qtd + i.qtd, valor: s.valor + i.valorFinal }),
    { qtd: 0, valor: 0 },
  );
  return (
    <div className="painel">
      <h3>{titulo}</h3>
      <p className="sub">{sub}</p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th className="direita">Qtd</th>
            <th className="direita">Valor final</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((e) => (
            <tr key={e.nome}>
              <td>{e.nome}</td>
              <td className="direita">{numero(e.qtd)}</td>
              <td className="direita">{moeda(e.valorFinal)}</td>
            </tr>
          ))}
          {itens.length > 0 && (
            <tr>
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="direita">
                <strong>{numero(tot.qtd)}</strong>
              </td>
              <td className="direita">
                <strong>{moeda(tot.valor)}</strong>
              </td>
            </tr>
          )}
          {itens.length === 0 && (
            <tr>
              <td colSpan={3} className="vazio">
                Sem dados no resumo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Bloco do relatório mensal pelo nome (ex.: ANTIGOS/NOVOS) — zero quando ausente. */
const blocoDe = (itens: BlocoResumo[], alvo: string): BlocoResumo =>
  itens.find((b) => b.nome.toUpperCase().includes(alvo.toUpperCase())) ?? {
    nome: alvo,
    qtd: 0,
    valor: 0,
    valorFinal: 0,
  };

const ESTILO_TOOLTIP = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
  fontSize: 12,
  color: '#172033',
};

const isoDeData = (br: string): string => {
  const p = br.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
};

function passaDataISO(iso: string, ini: string, fim: string): boolean {
  if (!ini && !fim) return true;
  if (!iso) return false;
  if (ini && iso < ini) return false;
  if (fim && iso > fim) return false;
  return true;
}

export default function Dashboard() {
  const { vendas, carregando, erro, recarregar, mesesOk, mesesErro } = useVendasCtx();
  const [mesSel, setMesSel] = useState<'' | Mes>('');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [copias, setCopias] = useState<Record<string, ResumoGeral | null>>({});
  const [copiasErro, setCopiasErro] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;
    Promise.allSettled(MESES.map((m) => matriz(`Cópia de ${m}`, 60, 12))).then((rs) => {
      if (!ativo) return;
      const mapa: Record<string, ResumoGeral | null> = {};
      const falhas: string[] = [];
      rs.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          try {
            mapa[MESES[i]] = parseResumoGeral(r.value.texto);
          } catch {
            mapa[MESES[i]] = null;
          }
        } else {
          mapa[MESES[i]] = null;
        }
        if (!mapa[MESES[i]]) falhas.push(MESES[i]);
      });
      setCopias(mapa);
      setCopiasErro(falhas);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const mesesResumo = useMemo(() => (mesSel ? [mesSel] : MESES.filter((m) => copias[m])), [mesSel, copias]);
  const temResumo = mesesResumo.length > 0;
  const comFiltroData = dataIni !== '' || dataFim !== '';
  const mes = MESES.includes(mesSel as Mes) ? (mesSel as Mes) : '';

  /** Janela fiscal do mês selecionado (fechamento 26 → 25), lida do relatório. */
  const janela = useMemo(() => {
    if (!mes) return '';
    const c = copias[mes];
    if (!c || c.diario.length === 0) return '';
    return `${c.diario[0].data} a ${c.diario[c.diario.length - 1].data}`;
  }, [mes, copias]);

  /* -------------------- CÓPIA (relatório oficial do mês) -------------------- */

  // Bloco diário → respeita mês E data (valor final, lançamentos, ticket, série).
  const resumoDia = useMemo(() => {
    let final = 0;
    let lanc = 0;
    for (const m of mesesResumo) {
      const c = copias[m];
      if (!c) continue;
      for (const d of c.diario) {
        if (!passaDataISO(isoDeData(d.data), dataIni, dataFim)) continue;
        final += d.valorFinal;
        lanc += d.lancados;
      }
    }
    return { final, lanc, ticket: lanc > 0 ? final / lanc : 0 };
  }, [copias, mesesResumo, dataIni, dataFim]);

  // Rodapé + blocos → totais do mês inteiro (não têm abertura por dia no relatório).
  const resumoMes = useMemo(() => {
    const r = {
      cancelQtd: 0, cancelValor: 0, bonifQtd: 0, bonifValor: 0,
      exposQtd: 0, aguardQtd: 0, aguardValor: 0,
    };
    const gestores = new Map<string, BlocoResumo>();
    const clientes = new Map<string, BlocoResumo>();
    const soma = (mapa: Map<string, BlocoResumo>, b: BlocoResumo) => {
      const e = mapa.get(b.nome) ?? { nome: b.nome, qtd: 0, valor: 0, valorFinal: 0 };
      e.qtd += b.qtd;
      e.valor += b.valor;
      e.valorFinal += b.valorFinal;
      mapa.set(b.nome, e);
    };
    for (const m of mesesResumo) {
      const c = copias[m];
      if (!c) continue;
      r.cancelQtd += c.cancelQtd; r.cancelValor += c.cancelValor;
      r.bonifQtd += c.bonifQtd; r.bonifValor += c.bonifValor;
      r.exposQtd += c.exposQtd;
      r.aguardQtd += c.aguardQtd; r.aguardValor += c.aguardValor;
      for (const b of c.gestores) soma(gestores, b);
      for (const b of c.clientes) soma(clientes, b);
    }
    const ordena = (mapa: Map<string, BlocoResumo>) => [...mapa.values()].sort((a, b) => b.valorFinal - a.valorFinal);
    return { ...r, gestores: ordena(gestores), clientes: ordena(clientes) };
  }, [copias, mesesResumo]);

  const serie = useMemo(() => {
    const mapa = new Map<string, { receita: number; pedidos: number; rot: string }>();
    for (const m of mesesResumo) {
      const c = copias[m];
      if (!c) continue;
      for (const d of c.diario) {
        const iso = isoDeData(d.data);
        if (!passaDataISO(iso, dataIni, dataFim)) continue;
        const e = mapa.get(iso) ?? { receita: 0, pedidos: 0, rot: d.data.slice(0, 5) };
        e.receita += d.valorFinal;
        e.pedidos += d.lancados;
        mapa.set(iso, e);
      }
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, x]) => ({ data: x.rot, receita: x.receita, pedidos: x.pedidos }));
  }, [copias, mesesResumo, dataIni, dataFim]);

  /* ------------------------- ABAS (lançamentos) ------------------------- */

  const validas = useMemo(() => vendas.filter(ehLinhaValida), [vendas]);
  const porMes = useMemo(() => (mesSel ? validas.filter((v) => v._mes === mesSel) : validas), [validas, mesSel]);
  const contabeis = useMemo(() => porMes.filter(ehContabil), [porMes]);
  const passaDataTab = (v: Venda): boolean => {
    if (!dataIni && !dataFim) return true;
    const raw = dataLancamentoValida(v);
    if (!raw) return false;
    const iso = new Date(raw).toISOString().slice(0, 10);
    if (dataIni && iso < dataIni) return false;
    if (dataFim && iso > dataFim) return false;
    return true;
  };
  const base = useMemo(() => contabeis.filter(passaDataTab), [contabeis, dataIni, dataFim]);
  const trocas = useMemo(
    () => porMes.filter((v) => ehLinhaValida(v) && marcador(v) === 'troca' && passaDataTab(v)),
    [porMes, dataIni, dataFim],
  );
  const vendedores = useMemo(() => topPor(base, (v) => campo(v, 'RPI')), [base]);
  const ofensores = useMemo(() => topPor(base, (v) => campo(v, 'RPI'), 10000).slice(-10).reverse(), [base]);
  const porUF = useMemo(() => topPor(base, (v) => campo(v, 'UF')), [base]);

  // Blocos do relatório mensal (valor final): recorrentes (ANTIGOS) e novos.
  const clientesAntigos = blocoDe(resumoMes.clientes, 'ANTIGOS');
  const clientesNovos = blocoDe(resumoMes.clientes, 'NOVOS');

  const porMesTabela = useMemo(
    () =>
      (mesSel ? [mesSel] : MESES.filter((m) => copias[m]))
        .map((m) => {
          const c = copias[m];
          if (!c) return null;
          const dias = c.diario.filter((d) => passaDataISO(isoDeData(d.data), dataIni, dataFim));
          return {
            mes: m,
            pedidos: dias.reduce((s, d) => s + d.lancados, 0),
            receita: dias.reduce((s, d) => s + d.valorFinal, 0),
          };
        })
        .filter((r): r is { mes: Mes; pedidos: number; receita: number } => r !== null),
    [copias, mesSel, dataIni, dataFim],
  );

  if (carregando) return <div className="estado">Carregando meses da planilha mestre…</div>;
  if (erro && !temResumo)
    return (
      <div className="estado">
        <p>Erro ao carregar: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  const rotuloMes = mesSel || 'Todos os meses';
  const rotuloFonte = comFiltroData ? 'período filtrado' : mesSel ? 'mês fechado' : 'todos os meses';

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Dashboard de vendas</h2>
          <p>
            {rotuloMes}
            {janela && ` (fechamento ${janela})`} • valor final {moeda(resumoDia.final)} •{' '}
            {numero(resumoDia.lanc)} lançamentos
            {mesesErro.length > 0 && ` • abas fora do ar: ${mesesErro.join(', ')}`}
            {copiasErro.length > 0 && ` • resumos fora do ar: ${copiasErro.join(', ')}`}
          </p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="barra">
        <select value={mesSel} onChange={(e) => setMesSel(e.target.value as '' | Mes)}>
          <option value="">Todos os meses</option>
          {MESES.map((m) => (
            <option key={m} value={m} disabled={!mesesOk.includes(m)}>
              {m}
            </option>
          ))}
        </select>
        <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} title="Data inicial" />
        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Data final" />
        {(mesSel || dataIni || dataFim) && (
          <button
            onClick={() => {
              setMesSel('');
              setDataIni('');
              setDataFim('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid-cards">
        <Card
          rotulo="Valor final (líquido)"
          valor={moeda(resumoDia.final)}
          detalhe={`relatório • ${rotuloFonte}`}
          icone={<Banknote />}
          tom="vermelho"
        />
        <Card
          rotulo="Lançamentos"
          valor={numero(resumoDia.lanc)}
          detalhe={`relatório • ${rotuloFonte}`}
          icone={<ClipboardList />}
          tom="azul"
        />
        <Card
          rotulo="Ticket médio"
          valor={moeda(resumoDia.ticket)}
          detalhe="valor final ÷ lançamentos"
          icone={<Receipt />}
          tom="roxo"
        />
        <Card
          rotulo="Clientes recorrentes"
          valor={moeda(clientesAntigos.valorFinal)}
          detalhe={`${numero(clientesAntigos.qtd)} pedidos • relatório • sem abertura por dia`}
          icone={<UsersRound />}
          tom="verde"
        />
      </div>

      <div className="grid-compacta">
        <Card
          rotulo="Novos clientes"
          valor={moeda(clientesNovos.valorFinal)}
          detalhe={`${numero(clientesNovos.qtd)} pedidos • relatório • sem abertura por dia`}
          icone={<UserPlus />}
          tom="ambar"
        />
        <Card
          rotulo="Aguardando lançamento"
          valor={moeda(resumoMes.aguardValor)}
          detalhe={`${numero(resumoMes.aguardQtd)} pendentes • sem abertura por dia`}
          icone={<Clock />}
          tom="ciano"
        />
        <Card
          rotulo="Cancelados"
          valor={numero(resumoMes.cancelQtd)}
          detalhe={`${moeda(resumoMes.cancelValor)} • sem abertura por dia`}
          icone={<Ban />}
          tom="laranja"
        />
        <Card
          rotulo="Expositores"
          valor={numero(resumoMes.exposQtd)}
          detalhe="só quantidade • sem abertura por dia"
          icone={<Store />}
          tom="azul"
        />
        <Card
          rotulo="Bonificação"
          valor={numero(resumoMes.bonifQtd)}
          detalhe={`${moeda(resumoMes.bonifValor)} • sem abertura por dia`}
          icone={<Gift />}
          tom="roxo"
        />
        <Card rotulo="Trocas" valor={numero(trocas.length)} detalhe="abas • não somam" icone={<Repeat />} tom="rosa" />
      </div>

      <div className="painel">
        <h3>Receita por dia (valor final)</h3>
        <p className="sub">Relatório mensal{comFiltroData ? ' — período filtrado' : ''}.</p>
        {serie.length === 0 ? (
          <p className="sub">Sem datas válidas para os filtros.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serie}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="data"
                tick={{ fill: '#98a2b3', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: '#98a2b3', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(value) => [moeda(value as number), 'Valor final']} />
              <Line type="monotone" dataKey="receita" stroke="#c92d25" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="painel">
        <h3>Receita por mês (valor final)</h3>
        <p className="sub">
          Relatório mensal. Ajusta com o mês e com o período de datas.
        </p>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="direita">Lançamentos</th>
              <th className="direita">Valor final</th>
            </tr>
          </thead>
          <tbody>
            {porMesTabela.map((r) => (
              <tr key={r.mes}>
                <td>{r.mes}</td>
                <td className="direita">{numero(r.pedidos)}</td>
                <td className="direita">{moeda(r.receita)}</td>
              </tr>
            ))}
            {porMesTabela.length === 0 && (
              <tr>
                <td colSpan={3} className="vazio">
                  Sem resumo para os filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TabelaBloco
        titulo="Resumo por clientes (novos × recorrentes)"
        sub="Bloco do relatório mensal, valor final — sem abertura por dia (total do mês)."
        itens={resumoMes.clientes}
      />
      <TabelaBloco
        titulo="Resumo por gestor"
        sub="Bloco do relatório mensal, valor final — sem abertura por dia (total do mês)."
        itens={resumoMes.gestores}
      />

      <div className="duas-col">
        <div className="painel">
          <h3>Top 10 vendedores (RPI)</h3>
          <p className="sub">Abas de lançamento, só contábeis, no filtro atual.</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th className="direita">Pedidos</th>
                <th className="direita">Receita</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((e, i) => (
                <tr key={e.nome}>
                  <td>{i + 1}</td>
                  <td>{e.nome}</td>
                  <td className="direita">{numero(e.pedidos)}</td>
                  <td className="direita">{moeda(e.receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="painel">
          <h3>Top 10 ofensores (menor venda)</h3>
          <p className="sub">Abas de lançamento, só contábeis, no filtro atual.</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th className="direita">Pedidos</th>
                <th className="direita">Receita</th>
              </tr>
            </thead>
            <tbody>
              {ofensores.map((e, i) => (
                <tr key={e.nome}>
                  <td>{i + 1}</td>
                  <td>{e.nome}</td>
                  <td className="direita">{numero(e.pedidos)}</td>
                  <td className="direita">{moeda(e.receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="painel">
        <h3>Top UF por receita</h3>
        <p className="sub">Abas de lançamento, no filtro atual.</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porUF} layout="vertical">
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#98a2b3', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="nome"
              width={96}
              tick={{ fill: '#475467', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => [moeda(v as number), 'Receita']} />
            <Bar dataKey="receita" fill="#c92d25" radius={[0, 6, 6, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!temResumo && (
        <p className="sub">
          Resumos mensais indisponíveis — confira as abas “Cópia de …” na planilha mestre.
        </p>
      )}
    </div>
  );
}
