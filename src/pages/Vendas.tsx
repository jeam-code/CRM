import { useMemo, useState } from 'react';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { NOMES_MESES_ANO } from '../lib/config';
import { campo, ehContabil, ehLinhaValida, marcador, valorLiquido } from '../lib/domain';
import { dataCurta, moeda, numero } from '../lib/format';

/**
 * Lista crua de todas as linhas de venda do ano (todas as abas mensais),
 * mescladas em uma única tabela — incluindo as colunas auxiliares de valor da
 * planilha (VELA8/PROMO2/SAZONAL) e total no rodapé. Nenhuma linha é inventada.
 */
type Situacao = 'vendas' | 'comAguardando' | 'todas';
type Ordem = 'padrao' | 'dataDesc' | 'dataAsc' | 'valorDesc' | 'cliente';

const ROTULO_ORDEM: Record<Ordem, string> = {
  padrao: 'Padrão (abas JANEIRO → NOVEMBRO)',
  dataDesc: 'Data (mais recente)',
  dataAsc: 'Data (mais antiga)',
  valorDesc: 'Valor Líquido (maior)',
  cliente: 'Cliente (A-Z)',
};

const ORDEM_MES = new Map<string, number>(NOMES_MESES_ANO.map((m, i) => [m, i] as const));

/** Célula das colunas auxiliares de valor (VELA8/PROMO2): número formatado ou texto cru. */
const tdValorAuxiliar = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (s === '') return <td className="direita">—</td>;
  const n = Number(s);
  return <td className="direita">{Number.isFinite(n) ? moeda(n) : s}</td>;
};

export default function Vendas() {
  const { vendas, mesesOk, carregando, erro, recarregar } = useVendasCtx();
  const [busca, setBusca] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRPI, setFiltroRPI] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('vendas');
  const [ordem, setOrdem] = useState<Ordem>('padrao');

  const validas = useMemo(() => vendas.filter(ehLinhaValida), [vendas]);

  const rpis = useMemo(
    () => [...new Set(validas.map((v) => campo(v, 'RPI')).filter(Boolean))].sort(),
    [validas],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const lista = validas.filter((v) => {
      if (filtroMes && v._mes !== filtroMes) return false;
      if (filtroRPI && campo(v, 'RPI') !== filtroRPI) return false;
      if (situacao === 'vendas' && !ehContabil(v)) return false;
      if (situacao === 'comAguardando' && marcador(v) !== null) return false;
      if (!q) return true;
      const cn = campo(v, 'CNPJ').replace(/\D/g, '');
      return (
        campo(v, 'Cliente').toLowerCase().includes(q) ||
        campo(v, 'CNPJ').toLowerCase().includes(q) ||
        campo(v, 'Nº Ped.').toLowerCase().includes(q) ||
        campo(v, 'UF').toLowerCase().includes(q) ||
        campo(v, 'RPI').toLowerCase().includes(q) ||
        (qd !== '' && cn.includes(qd))
      );
    });
    return [...lista].sort((a, b) => {
      if (ordem === 'valorDesc') return valorLiquido(b) - valorLiquido(a);
      if (ordem === 'cliente') return campo(a, 'Cliente').localeCompare(campo(b, 'Cliente'), 'pt-BR');
      if (ordem === 'dataDesc' || ordem === 'dataAsc') {
        const da = new Date(campo(a, 'Data Lançamento')).getTime() || 0;
        const db = new Date(campo(b, 'Data Lançamento')).getTime() || 0;
        return ordem === 'dataDesc' ? db - da : da - db;
      }
      const ma = ORDEM_MES.get(a._mes) ?? 99;
      const mb = ORDEM_MES.get(b._mes) ?? 99;
      return ma - mb || a._linha - b._linha;
    });
  }, [validas, busca, filtroMes, filtroRPI, situacao, ordem]);

  const soma = useMemo(() => filtradas.reduce((s, v) => s + valorLiquido(v), 0), [filtradas]);

  if (carregando) return <div className="estado">Carregando vendas da API…</div>;
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
          <h2>Todas as vendas</h2>
          <p>
            {numero(filtradas.length)} de {numero(validas.length)} linhas válidas • soma do Valor Líquido exibido:{' '}
            {moeda(soma)} • dados crus das abas mensais: janeiro e fevereiro conferem exato com a cópia oficial, nos
            meses seguintes a cópia repassa menos lançamentos (divergência interna da própria planilha, mostrada como
            está)
          </p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="barra">
        <input
          className="busca"
          placeholder="Buscar cliente, CNPJ, pedido, UF ou RPI…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
          <option value="">Todas as abas</option>
          {mesesOk.map((m) => (
            <option key={m} value={m}>
              {m}
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
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao)}>
          <option value="vendas">Vendas contábeis (com pedido e valor)</option>
          <option value="comAguardando">Vendas + aguardando lançamento</option>
          <option value="todas">Todas as linhas (inclui marcadores)</option>
        </select>
        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          title="Ordenação da tabela"
        >
          {(Object.keys(ROTULO_ORDEM) as Ordem[]).map((o) => (
            <option key={o} value={o}>
              Ordenar: {ROTULO_ORDEM[o]}
            </option>
          ))}
        </select>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="painel">
        <table>
          <thead>
            <tr>
              <th>Aba</th>
              <th>Data</th>
              <th>Nº Ped.</th>
              <th>Cliente</th>
              <th>CNPJ</th>
              <th>UF</th>
              <th>RPI</th>
              <th>C/N</th>
              <th className="direita">VELA8</th>
              <th className="direita">PROMO2</th>
              <th>Sazonal</th>
              <th className="direita">Valor Líquido</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={`${v._mes}-${v._linha}`}>
                <td>
                  <span className="pill">{v._mes}</span>
                </td>
                <td>{dataCurta(v['Data Lançamento'])}</td>
                <td>{campo(v, 'Nº Ped.') || '—'}</td>
                <td>{campo(v, 'Cliente') || '(sem nome)'}</td>
                <td>{campo(v, 'CNPJ') || '—'}</td>
                <td>{campo(v, 'UF') || '—'}</td>
                <td>{campo(v, 'RPI') || '—'}</td>
                <td>{campo(v, 'Novos Clientes') || '—'}</td>
                {tdValorAuxiliar(v['VELA8'])}
                {tdValorAuxiliar(v['PROMO2'])}
                <td>{campo(v, 'SAZONAL') || '—'}</td>
                <td className="direita">{moeda(valorLiquido(v))}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={12} className="vazio">
                  Nenhuma venda encontrada para os filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtradas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={11} className="direita">
                  Total exibido ({numero(filtradas.length)} linhas)
                </td>
                <td className="direita">{moeda(soma)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
