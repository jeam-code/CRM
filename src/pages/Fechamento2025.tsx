import { useEffect, useMemo, useState } from 'react';
import { Banknote, ExternalLink, Gauge, Layers, Percent, PieChart, Receipt, Target } from 'lucide-react';
import { Card } from '../components/ui';
import { moeda, normalizarNome, numero } from '../lib/format';
import {
  ABAS_2025,
  PLANILHA_2025_URL,
  abaPadrao2025,
  buscarFechamento2025,
  type Aba2025,
  type Fechamento2025,
  type Linha2025,
} from '../lib/fechamento2025';

/**
 * Aba FECHAMENTO 2025 — relatório mensal da planilha pública
 * "Acompanhamento de RPIs 2025" (a mesma que o gestor anexou em XLSX).
 *
 * Os dados são lidos direto do Google Sheets (endpoint export em CSV), uma aba
 * por mês, com seletor jan → dez. Nada é copiado para o repositório e nenhum
 * valor é inventado: meta, vendas por período, total, alcance, cota e o
 * ranking por RPI vêm exatamente como estão na planilha. Os únicos cálculos
 * próprios são as linhas de total (soma) e o alcance total = vendas ÷ soma
 * das metas, mesma base do "ALCANCE - GERAL" da planilha.
 */
const pctTxt = (pct: number | null): string =>
  pct === null ? '—' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

type CampoOrdem = string;

/** Valor de uma coluna do ranking; `null` = célula vazia na planilha. */
function valorCampo(l: Linha2025, campo: CampoOrdem): number | string | null {
  if (campo.startsWith('periodo:')) return l.periodos[Number(campo.slice('periodo:'.length))] ?? null;
  if (campo.startsWith('meta:')) return l.metas[Number(campo.slice('meta:'.length))] ?? null;
  switch (campo) {
    case 'equipe':
      return l.equipe;
    case 'vendedor':
      return l.vendedor;
    case 'uf':
      return l.uf;
    case 'classe':
      return l.classe;
    case 'meta':
      return l.somaMetas;
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
  const [aba, setAba] = useState<Aba2025>(() => abaPadrao2025());
  const [dados, setDados] = useState<Fechamento2025 | null>(null);
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
    setCarregando(true);
    setErro(null);
    buscarFechamento2025(aba)
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [aba, versao]);

  const linhasOrdenadas = useMemo(() => {
    if (!dados) return [];
    const q = normalizarNome(busca);
    const filtradas = q
      ? dados.linhas.filter(
          (l) =>
            normalizarNome(l.vendedor).includes(q) ||
            normalizarNome(l.codigo).includes(q) ||
            normalizarNome(l.uf).includes(q) ||
            normalizarNome(l.equipe).includes(q),
        )
      : dados.linhas;
    const mult = ordem.dir === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => comparar(valorCampo(a, ordem.campo), valorCampo(b, ordem.campo), mult));
  }, [dados, busca, ordem]);

  const alternarOrdem = (campo: CampoOrdem): void => {
    setOrdem((atual) =>
      atual.campo === campo
        ? { campo, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
        : {
            campo,
            dir:
              campo === 'equipe' || campo === 'vendedor' || campo === 'uf' || campo === 'classe'
                ? 'asc'
                : 'desc',
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

  if (carregando && !dados) {
    return <div className="estado">Carregando o fechamento de {aba.mes} na planilha…</div>;
  }
  if (erro && !dados) {
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={() => setVersao((v) => v + 1)}>Tentar novamente</button>
      </div>
    );
  }
  if (!dados) return null;

  const t = dados.totais;
  const falta = (t.somaMetas ?? 0) - (t.total ?? 0);
  const detalheAlcance =
    falta > 0 ? `falta ${moeda(falta)}` : falta < 0 ? `acima da meta em ${moeda(-falta)}` : 'meta atingida';

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Fechamento 2025</h2>
          <p>
            Relatório mensal da planilha oficial “Acompanhamento de RPIs 2025” — leitura direta do Google Sheets, sem
            cópia local e sem dado fictício • meta, vendas por período, total, alcance, cota e ranking por RPI
          </p>
        </div>
        <button onClick={() => window.open(PLANILHA_2025_URL, '_blank', 'noopener')} title="Abrir a planilha oficial">
          <ExternalLink />
          Abrir planilha
        </button>
      </div>

      <div className="barra">
        {ABAS_2025.map((a) => (
          <button
            key={a.gid}
            className={a.gid === aba.gid ? 'primario' : ''}
            title={`Abrir a aba ${a.mes}`}
            onClick={() => setAba(a)}
          >
            {a.curto}
          </button>
        ))}
        <button onClick={() => setVersao((v) => v + 1)} title="Reler a planilha (o mês fica em cache até recarregar)">
          Atualizar
        </button>
      </div>

      <div className="grid-cards">
        <Card
          rotulo={`Meta — ${dados.mes}`}
          valor={moeda(t.somaMetas)}
          detalhe={`${dados.rotulos.metas.length} coluna(s) de meta • soma das metas`}
          icone={<Target />}
          tom="brand"
        />
        <Card
          rotulo="Vendas do mês"
          valor={moeda(t.total)}
          detalhe={`Total Mês • soma de ${dados.rotulos.periodos.length} período(s)`}
          icone={<Banknote />}
          tom="success"
        />
        <Card
          rotulo="Alcance da meta"
          valor={pctTxt(t.pctGeral)}
          detalhe={`vendas ÷ metas • ${detalheAlcance}`}
          icone={<Percent />}
          tom="info"
        />
        <Card
          rotulo="RPIs no mês"
          valor={numero(t.rpis)}
          detalhe={`${dados.equipes.length} equipe(s) • total do mês por RPI`}
          icone={<Layers />}
          tom="purple"
        />
      </div>

      <div className="grid-compacta">
        <Card
          rotulo="Cota proporcional"
          valor={moeda(t.cota)}
          detalhe="soma da cota proporcional à data de corte"
          icone={<PieChart />}
          tom="warning"
        />
        <Card
          rotulo="Alcance da cota"
          valor={pctTxt(t.pctProp)}
          detalhe="vendas ÷ cota proporcional"
          icone={<Gauge />}
          tom="orange"
        />
        <Card
          rotulo="Ticket médio"
          valor={moeda(t.rpis > 0 ? (t.total ?? 0) / t.rpis : null)}
          detalhe={`total do mês ÷ ${numero(t.rpis)} RPIs`}
          icone={<Receipt />}
          tom="info"
        />
      </div>

      <div className="painel">
        <h3>Metas e períodos — {dados.mes}</h3>
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
              {dados.rotulos.metas.map((r, i) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="direita">{moeda(t.metas[i])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Soma das metas</td>
                <td className="direita">{moeda(t.somaMetas)}</td>
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
              {dados.rotulos.periodos.map((r, i) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="direita">{moeda(t.periodos[i])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total Mês</td>
                <td className="direita">{moeda(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="painel">
        <h3>Resumo por equipe</h3>
        <p className="sub">
          Agregação das linhas do relatório por equipe (FB = Festa, SG = Sérgio). % de alcance = vendas ÷ soma das
          metas da equipe.
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
            {dados.equipes.map((e) => (
              <tr key={e.equipe}>
                <td>{e.equipe}</td>
                <td className="direita">{numero(e.rpis)}</td>
                <td className="direita">{moeda(e.metas)}</td>
                <td className="direita">{moeda(e.vendas)}</td>
                <td className="direita">{pctTxt(e.pctGeral)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="direita">{numero(t.rpis)}</td>
              <td className="direita">{moeda(t.somaMetas)}</td>
              <td className="direita">{moeda(t.total)}</td>
              <td className="direita">{pctTxt(t.pctGeral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="painel">
        <h3>Ranking por RPI — {dados.mes}</h3>
        <p className="sub">
          Clique nos títulos das colunas para ordenar — por padrão, maior Total Mês primeiro. As colunas de % vêm
          lidas da planilha; Total Mês é a soma dos períodos (conferido linha a linha).
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
            {numero(linhasOrdenadas.length)} de {numero(dados.linhas.length)} RPIs
          </span>
        </div>
        <table>
          <thead>
            <tr>
              {thOrdenavel('equipe', 'Equipe')}
              {thOrdenavel('vendedor', 'Vendedor')}
              {thOrdenavel('uf', 'UF')}
              {thOrdenavel('classe', 'Classe')}
              {thOrdenavel('meta', 'Meta', 'direita')}
              {dados.rotulos.periodos.map((r, i) => thOrdenavel(`periodo:${i}`, r, 'direita'))}
              {thOrdenavel('total', 'Total Mês', 'direita')}
              {thOrdenavel('pctGeral', '% alcance', 'direita')}
              {thOrdenavel('cota', 'Cota', 'direita')}
              {thOrdenavel('pctProp', '% cota prop.', 'direita')}
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((l, i) => (
              <tr key={`${l.equipe}-${l.codigo || i}-${l.vendedor}`}>
                <td>{l.equipe}</td>
                <td>{l.vendedor}</td>
                <td>{l.uf}</td>
                <td>{l.classe}</td>
                <td className="direita">{moeda(l.somaMetas)}</td>
                {l.periodos.map((p, j) => (
                  <td key={dados.rotulos.periodos[j] ?? j} className="direita">
                    {moeda(p)}
                  </td>
                ))}
                <td className="direita destaque">{moeda(l.total)}</td>
                <td className="direita">{pctTxt(l.pctGeral)}</td>
                <td className="direita">{moeda(l.cota)}</td>
                <td className="direita">{pctTxt(l.pctProp)}</td>
              </tr>
            ))}
            {linhasOrdenadas.length === 0 && (
              <tr>
                <td colSpan={10 + dados.rotulos.periodos.length}>Nenhum RPI corresponde à busca.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total do mês ({aba.mes})</td>
              <td className="direita">{moeda(t.somaMetas)}</td>
              {t.periodos.map((p, i) => (
                <td key={dados.rotulos.periodos[i] ?? i} className="direita">
                  {moeda(p)}
                </td>
              ))}
              <td className="direita">{moeda(t.total)}</td>
              <td className="direita">{pctTxt(t.pctGeral)}</td>
              <td className="direita">{moeda(t.cota)}</td>
              <td className="direita">{pctTxt(t.pctProp)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {dados.rotulos.extras.length > 0 && (
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
              {dados.rotulos.extras.map((r, i) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="direita">{moeda(t.extras[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
