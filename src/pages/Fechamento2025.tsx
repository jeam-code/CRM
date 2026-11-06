import { useEffect, useMemo, useState } from 'react';
import { Banknote, ExternalLink, Gauge, Layers, Percent, PieChart, Receipt, Target } from 'lucide-react';
import { Card } from '../components/ui';
import { moeda, normalizarNome, numero } from '../lib/format';
import {
  ABAS_2025,
  PLANILHA_2025_URL,
  abaPadrao2025,
  buscarFechamento2025,
  buscarTodosFechamento2025,
  limparCacheFechamento2025,
  type Aba2025,
  type Consolidado2025,
  type Fechamento2025,
  type MesConsolidado2025,
  type ResumoEquipe2025,
} from '../lib/fechamento2025';

/**
 * Aba FECHAMENTO 2025 — relatório mensal da planilha pública
 * "Acompanhamento de RPIs 2025" (a mesma que o gestor anexou em XLSX).
 *
 * Fonte única: leitura direta do Google Sheets (endpoint export em CSV), sem
 * backend, sem cópia local e sem dado fictício. Seletor jan → dez + botão
 * "Todos os meses" (soma das 12 abas, com painel mês a mês).
 *
 * Os valores de % e COTA vêm lidos da planilha; os únicos cálculos próprios
 * são as linhas de total (soma) e o alcance = vendas ÷ metas, mesma base do
 * "ALCANCE - GERAL" da planilha.
 */
const pctTxt = (pct: number | null): string =>
  pct === null ? '—' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** `moeda` trata null como 0 — aqui célula vazia da planilha fica "—". */
const moedaOu = (valor: number | null): string => (valor === null ? '—' : moeda(valor));

type CampoOrdem = string;

/** Uma linha do ranking (mês ou consolidado), já em formato de exibição. */
interface RowRanking {
  chave: string;
  equipe: string;
  codigo: string;
  vendedor: string;
  uf: string;
  classe: string;
  meses: number | null;
  meta: number | null;
  periodos: (number | null)[];
  total: number | null;
  pctGeral: number | null;
  cota: number | null;
  pctProp: number | null;
}

/** Tudo que as telas compartilham entre "um mês" e "todos os meses". */
interface Visao {
  titulo: string;
  ehTodos: boolean;
  rotulos: { metas: string[]; periodos: string[]; extras: string[] };
  equipes: ResumoEquipe2025[];
  somaMetas: number | null;
  total: number | null;
  cota: number | null;
  pctGeral: number | null;
  pctProp: number | null;
  rpis: number;
  rpisDistintos: number | null;
  metasCol: (number | null)[];
  periodosCol: (number | null)[];
  extrasCol: (number | null)[];
  linhas: RowRanking[];
  meses: MesConsolidado2025[] | null;
}

type Modo = { tipo: 'mes'; aba: Aba2025 } | { tipo: 'todos' };

/** Valor de uma coluna do ranking; `null` = célula vazia na planilha. */
function valorCampo(l: RowRanking, campo: CampoOrdem): number | string | null {
  if (campo.startsWith('periodo:')) return l.periodos[Number(campo.slice('periodo:'.length))] ?? null;
  switch (campo) {
    case 'equipe':
      return l.equipe;
    case 'vendedor':
      return l.vendedor;
    case 'uf':
      return l.uf;
    case 'classe':
      return l.classe;
    case 'meses':
      return l.meses;
    case 'meta':
      return l.meta;
    case 'total':
      return l.total;
    case 'pctGeral':
      return l.pctGeral;
    case 'cota':
      return l.cota;
    case 'pctProp':
      return l.pctProp;
    default:
      return null;
  }
}

/** Nulos sempre no fim; texto com locale pt-BR; número por valor. */
function comparar(a: number | string | null, b: number | string | null, mult: number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'string' || typeof b === 'string') {
    return mult * String(a).localeCompare(String(b), 'pt-BR');
  }
  return mult * (a - b);
}

export default function Fechamento2025() {
  const [modo, setModo] = useState<Modo>(() => ({ tipo: 'mes', aba: abaPadrao2025() }));
  const [dados, setDados] = useState<Fechamento2025 | null>(null);
  const [consol, setConsol] = useState<Consolidado2025 | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; dir: 'asc' | 'desc' }>({
    campo: 'total',
    dir: 'desc',
  });

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setConsol(null);
    setCarregando(true);
    setErro(null);
    const falha = (e: unknown) => {
      if (vivo) setErro(e instanceof Error ? e.message : String(e));
    };
    const fim = () => {
      if (vivo) setCarregando(false);
    };
    if (modo.tipo === 'todos') {
      buscarTodosFechamento2025()
        .then((c) => {
          if (vivo) setConsol(c);
        })
        .catch(falha)
        .finally(fim);
    } else {
      buscarFechamento2025(modo.aba)
        .then((d) => {
          if (vivo) setDados(d);
        })
        .catch(falha)
        .finally(fim);
    }
    return () => {
      vivo = false;
    };
  }, [modo, versao]);

  /** Referências estáveis: clicar no mês já aberto não recarrega. */
  const irParaMes = (aba: Aba2025): void =>
    setModo((m) => (m.tipo === 'mes' && m.aba.gid === aba.gid ? m : { tipo: 'mes', aba }));
  const irParaTodos = (): void => setModo((m) => (m.tipo === 'todos' ? m : { tipo: 'todos' }));
  const atualizar = (): void => {
    limparCacheFechamento2025();
    setVersao((v) => v + 1);
  };

  const visao = useMemo<Visao | null>(() => {
    if (modo.tipo === 'todos') {
      if (!consol) return null;
      return {
        titulo: 'Todos os meses',
        ehTodos: true,
        rotulos: { metas: [], periodos: [], extras: [] },
        equipes: consol.equipes,
        somaMetas: consol.totais.metas,
        total: consol.totais.vendas,
        cota: consol.totais.cota,
        pctGeral: consol.totais.pctGeral,
        pctProp: consol.totais.pctProp,
        rpis: consol.totais.rpis,
        rpisDistintos: consol.rpis.length,
        metasCol: [],
        periodosCol: [],
        extrasCol: [],
        linhas: consol.rpis.map((r) => ({
          chave: `${r.codigo || 'X'}-${r.vendedor}`,
          equipe: r.equipe,
          codigo: r.codigo,
          vendedor: r.vendedor,
          uf: r.uf,
          classe: r.classe,
          meses: r.meses,
          meta: r.metas,
          periodos: [],
          total: r.vendas,
          pctGeral: r.pctGeral,
          cota: r.cota,
          pctProp: r.pctProp,
        })),
        meses: consol.meses,
      };
    }
    if (!dados) return null;
    return {
      titulo: dados.mes,
      ehTodos: false,
      rotulos: dados.rotulos,
      equipes: dados.equipes,
      somaMetas: dados.totais.somaMetas,
      total: dados.totais.total,
      cota: dados.totais.cota,
      pctGeral: dados.totais.pctGeral,
      pctProp: dados.totais.pctProp,
      rpis: dados.totais.rpis,
      rpisDistintos: null,
      metasCol: dados.totais.metas,
      periodosCol: dados.totais.periodos,
      extrasCol: dados.totais.extras,
      linhas: dados.linhas.map((l, i) => ({
        chave: `${l.equipe}-${l.codigo || i}-${l.vendedor}`,
        equipe: l.equipe,
        codigo: l.codigo,
        vendedor: l.vendedor,
        uf: l.uf,
        classe: l.classe,
        meses: null,
        meta: l.somaMetas,
        periodos: l.periodos,
        total: l.total,
        pctGeral: l.pctGeral,
        cota: l.cota,
        pctProp: l.pctProp,
      })),
      meses: null,
    };
  }, [modo, dados, consol]);

  const linhasOrdenadas = useMemo(() => {
    if (!visao) return [];
    const q = normalizarNome(busca);
    const filtradas = q
      ? visao.linhas.filter(
          (l) =>
            normalizarNome(l.vendedor).includes(q) ||
            normalizarNome(l.codigo).includes(q) ||
            normalizarNome(l.equipe).includes(q) ||
            normalizarNome(l.uf).includes(q),
        )
      : visao.linhas;
    const mult = ordem.dir === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => comparar(valorCampo(a, ordem.campo), valorCampo(b, ordem.campo), mult));
  }, [visao, busca, ordem]);

  const alternarOrdem = (campo: CampoOrdem): void => {
    setOrdem((atual) =>
      atual.campo === campo
        ? { campo, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
        : {
            campo,
            dir:
              campo === 'equipe' || campo === 'vendedor' || campo === 'uf' || campo === 'classe' ? 'asc' : 'desc',
          },
    );
  };

  const thOrdenavel = (campo: CampoOrdem, label: string, className?: string) => (
    <th
      className={className}
      onClick={() => alternarOrdem(campo)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      title="Clique para ordenar"
    >
      {label} {ordem.campo === campo ? (ordem.dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  if (erro && !visao) {
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={atualizar}>Tentar novamente</button>
      </div>
    );
  }
  if (carregando && !visao) {
    return (
      <div className="estado">
        {modo.tipo === 'todos'
          ? 'Carregando os 12 meses na planilha…'
          : `Carregando o fechamento de ${modo.aba.mes} na planilha…`}
      </div>
    );
  }
  if (!visao) return null;

  const ehTodos = visao.ehTodos;
  const falta = (visao.somaMetas ?? 0) - (visao.total ?? 0);
  const detalheAlcance =
    falta > 0 ? `falta ${moeda(falta)}` : falta < 0 ? `acima da meta em ${moeda(-falta)}` : 'meta atingida';
  const ticket = visao.rpis > 0 ? (visao.total ?? 0) / visao.rpis : null;
  const prefixoCol = 4 + (ehTodos ? 1 : 0); // Equipe..Classe (+ Meses no consolidado)
  const totalColunas = prefixoCol + 1 + visao.rotulos.periodos.length + 3;

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Fechamento 2025</h2>
          <p>
            Relatório da planilha oficial “Acompanhamento de RPIs 2025” — leitura direta do Google Sheets, sem cópia
            local e sem dado fictício • meta, vendas por período, total, alcance, cota e ranking por RPI
          </p>
        </div>
        <button onClick={() => window.open(PLANILHA_2025_URL, '_blank', 'noopener')} title="Abrir a planilha oficial">
          <ExternalLink />
          Abrir planilha
        </button>
      </div>

      <div className="barra">
        <button
          className={modo.tipo === 'todos' ? 'primario' : ''}
          title="Somar os 12 meses da planilha"
          onClick={irParaTodos}
        >
          Todos os meses
        </button>
        {ABAS_2025.map((a) => (
          <button
            key={a.gid}
            className={modo.tipo === 'mes' && a.gid === modo.aba.gid ? 'primario' : ''}
            title={`Abrir a aba ${a.mes}`}
            onClick={() => irParaMes(a)}
          >
            {a.curto}
          </button>
        ))}
        <button onClick={atualizar} title="Reler a planilha (o conteúdo fica em cache até atualizar)">
          Atualizar
        </button>
      </div>

      <div className="grid-cards">
        <Card
          rotulo={`Meta — ${ehTodos ? '2025' : visao.titulo}`}
          valor={moedaOu(visao.somaMetas)}
          detalhe={ehTodos ? 'soma das 12 abas • soma das metas' : `${visao.rotulos.metas.length} coluna(s) de meta • soma das metas`}
          icone={<Target />}
          tom="brand"
        />
        <Card
          rotulo={ehTodos ? 'Vendas — 2025' : 'Vendas do mês'}
          valor={moedaOu(visao.total)}
          detalhe={
            ehTodos
              ? 'soma dos Total Mês das 12 abas'
              : `Total Mês • soma de ${visao.rotulos.periodos.length} período(s)`
          }
          icone={<Banknote />}
          tom="success"
        />
        <Card
          rotulo="Alcance da meta"
          valor={pctTxt(visao.pctGeral)}
          detalhe={`vendas ÷ metas • ${detalheAlcance}`}
          icone={<Percent />}
          tom="info"
        />
        <Card
          rotulo={ehTodos ? 'RPIs no ano' : 'RPIs no mês'}
          valor={numero(visao.rpis)}
          detalhe={
            ehTodos
              ? `${numero(visao.rpisDistintos)} RPIs distintos • soma das 12 abas`
              : `${visao.equipes.length} equipe(s) • total do mês por RPI`
          }
          icone={<Layers />}
          tom="purple"
        />
      </div>

      <div className="grid-compacta">
        <Card
          rotulo={ehTodos ? 'Cota proporcional — 2025' : 'Cota proporcional'}
          valor={moedaOu(visao.cota)}
          detalhe="soma da cota proporcional à data de corte"
          icone={<PieChart />}
          tom="warning"
        />
        <Card
          rotulo="Alcance da cota"
          valor={pctTxt(visao.pctProp)}
          detalhe="vendas ÷ cota proporcional"
          icone={<Gauge />}
          tom="orange"
        />
        <Card
          rotulo="Ticket médio"
          valor={moedaOu(ticket)}
          detalhe={`total ÷ ${numero(visao.rpis)} RPIs`}
          icone={<Receipt />}
          tom="info"
        />
      </div>

      {ehTodos && visao.meses && (
        <div className="painel">
          <h3>Mês a mês — 2025</h3>
          <p className="sub">
            Totais de cada aba mensal da planilha. A última linha soma os 12 meses (é a mesma base dos cards acima).
          </p>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th className="direita">RPIs</th>
                <th className="direita">Meta</th>
                <th className="direita">Vendas</th>
                <th className="direita">% alcance</th>
                <th className="direita">Cota</th>
                <th className="direita">% cota prop.</th>
              </tr>
            </thead>
            <tbody>
              {visao.meses.map((m) => (
                <tr key={m.mes}>
                  <td>{m.mes}</td>
                  <td className="direita">{numero(m.rpis)}</td>
                  <td className="direita">{moedaOu(m.metas)}</td>
                  <td className="direita">{moedaOu(m.vendas)}</td>
                  <td className="direita">{pctTxt(m.pctGeral)}</td>
                  <td className="direita">{moedaOu(m.cota)}</td>
                  <td className="direita">{pctTxt(m.pctProp)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total 2025</td>
                <td className="direita">{numero(visao.rpis)}</td>
                <td className="direita">{moedaOu(visao.somaMetas)}</td>
                <td className="direita">{moedaOu(visao.total)}</td>
                <td className="direita">{pctTxt(visao.pctGeral)}</td>
                <td className="direita">{moedaOu(visao.cota)}</td>
                <td className="direita">{pctTxt(visao.pctProp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!ehTodos && (
        <div className="painel">
          <h3>Metas e períodos — {visao.titulo}</h3>
          <p className="sub">
            Colunas do relatório mensal. Cada meta e cada período é uma coluna da planilha; os totais abaixo são a soma
            das próprias colunas.
          </p>
          <div className="duas-col">
            <table>
              <thead>
                <tr>
                  <th>Meta</th>
                  <th className="direita">Valor</th>
                </tr>
              </thead>
              <tbody>
                {visao.rotulos.metas.map((r, i) => (
                  <tr key={r}>
                    <td>{r}</td>
                    <td className="direita">{moedaOu(visao.metasCol[i] ?? null)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Soma das metas</td>
                  <td className="direita">{moedaOu(visao.somaMetas)}</td>
                </tr>
              </tfoot>
            </table>
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="direita">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {visao.rotulos.periodos.map((r, i) => (
                  <tr key={r}>
                    <td>{r}</td>
                    <td className="direita">{moedaOu(visao.periodosCol[i] ?? null)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Mês</td>
                  <td className="direita">{moedaOu(visao.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="painel">
        <h3>Resumo por equipe</h3>
        <p className="sub">
          Agregação das linhas do relatório por equipe (FB = Festa, SG = Sérgio). % de alcance = vendas ÷ soma das
          metas da equipe{ehTodos ? ', somando os 12 meses' : ''}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Equipe</th>
              <th className="direita">RPIs</th>
              <th className="direita">Meta</th>
              <th className="direita">Vendas</th>
              <th className="direita">% alcance</th>
            </tr>
          </thead>
          <tbody>
            {visao.equipes.map((e) => (
              <tr key={e.equipe}>
                <td>{e.equipe}</td>
                <td className="direita">{numero(e.rpis)}</td>
                <td className="direita">{moedaOu(e.metas)}</td>
                <td className="direita">{moedaOu(e.vendas)}</td>
                <td className="direita">{pctTxt(e.pctGeral)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="direita">{numero(visao.rpis)}</td>
              <td className="direita">{moedaOu(visao.somaMetas)}</td>
              <td className="direita">{moedaOu(visao.total)}</td>
              <td className="direita">{pctTxt(visao.pctGeral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="painel">
        <h3>Ranking por RPI — {visao.titulo}</h3>
        <p className="sub">
          {ehTodos
            ? 'Cada linha é um RPI somado nos 12 meses (coluna “Meses” mostra em quantos meses apareceu). As colunas de período variam por mês e por isso não são somadas — use o seletor de mês para vê-las.'
            : 'Clique nos títulos das colunas para ordenar — por padrão, maior Total Mês primeiro. As colunas de % vêm lidas da planilha; Total Mês é a soma dos períodos (conferido linha a linha).'}
        </p>
        <div className="barra">
          <input
            className="busca"
            placeholder="Buscar por vendedor, código ou UF…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 280 }}
          />
          {busca && <button onClick={() => setBusca('')}>Limpar busca</button>}
          <span className="mono">
            {numero(linhasOrdenadas.length)} de {numero(visao.linhas.length)} RPIs
          </span>
        </div>
        <table>
          <thead>
            <tr>
              {thOrdenavel('equipe', 'Equipe')}
              {thOrdenavel('vendedor', 'Vendedor')}
              {thOrdenavel('uf', 'UF')}
              {thOrdenavel('classe', 'Classe')}
              {ehTodos && thOrdenavel('meses', 'Meses', 'direita')}
              {thOrdenavel('meta', 'Meta', 'direita')}
              {visao.rotulos.periodos.map((r, i) => thOrdenavel(`periodo:${i}`, r, 'direita'))}
              {thOrdenavel('total', ehTodos ? 'Vendas' : 'Total Mês', 'direita')}
              {thOrdenavel('pctGeral', '% alcance', 'direita')}
              {thOrdenavel('cota', 'Cota', 'direita')}
              {thOrdenavel('pctProp', '% cota prop.', 'direita')}
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((l) => (
              <tr key={l.chave}>
                <td>{l.equipe}</td>
                <td>{l.vendedor}</td>
                <td>{l.uf}</td>
                <td>{l.classe}</td>
                {ehTodos && <td className="direita">{numero(l.meses ?? 0)}</td>}
                <td className="direita">{moedaOu(l.meta)}</td>
                {l.periodos.map((p, i) => (
                  <td key={visao.rotulos.periodos[i] ?? i} className="direita">
                    {moedaOu(p)}
                  </td>
                ))}
                <td className="direita destaque">{moedaOu(l.total)}</td>
                <td className="direita">{pctTxt(l.pctGeral)}</td>
                <td className="direita">{moedaOu(l.cota)}</td>
                <td className="direita">{pctTxt(l.pctProp)}</td>
              </tr>
            ))}
            {linhasOrdenadas.length === 0 && (
              <tr>
                <td colSpan={totalColunas}>Nenhum RPI corresponde à busca.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={prefixoCol}>{ehTodos ? 'Total do ano' : `Total do mês (${visao.titulo})`}</td>
              <td className="direita">{moedaOu(visao.somaMetas)}</td>
              {visao.periodosCol.map((p, i) => (
                <td key={visao.rotulos.periodos[i] ?? i} className="direita">
                  {moedaOu(p)}
                </td>
              ))}
              <td className="direita">{moedaOu(visao.total)}</td>
              <td className="direita">{pctTxt(visao.pctGeral)}</td>
              <td className="direita">{moedaOu(visao.cota)}</td>
              <td className="direita">{pctTxt(visao.pctProp)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!ehTodos && visao.rotulos.extras.length > 0 && (
        <div className="painel">
          <h3>Colunas complementares</h3>
          <p className="sub">Totais das colunas extras do relatório do mês, lidos da planilha.</p>
          <table>
            <thead>
              <tr>
                <th>Coluna</th>
                <th className="direita">Total</th>
              </tr>
            </thead>
            <tbody>
              {visao.rotulos.extras.map((r, i) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="direita">{moedaOu(visao.extrasCol[i] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
