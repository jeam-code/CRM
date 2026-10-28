import { useEffect, useMemo, useState } from 'react';
import { listarTudo, type Registro } from '../lib/api';
import { META_DEFS } from '../lib/metas';
import { campo, ehContabil, valorFormulario, valorLiquido } from '../lib/domain';
import { dataISO, moeda, normalizarNome, numero } from '../lib/format';
import { useVendasCtx } from '../state/VendasContext';
import type { Venda } from '../lib/domain';

/**
 * Aba META — acompanhamento das metas por responsável.
 * Janela: dia 26 → último dia do mês corrente (calendário), avaliada pela
 * coluna "Data E-mail" das abas mensais. Realizado = soma do Valor Líquido dos
 * lançamentos contábeis (com Nº Ped. e valor) dos RPIs que cada responsável
 * cuida (lista extraída da aba Equipe); Previsto = VALOR FORMULÁRIO (valor de
 * tabela) das mesmas vendas. Nenhum valor é inventado.
 */
interface MetaLinha {
  responsavel: string;
  meta: number;
  nRpis: number;
  previsto: number;
  realizado: number;
  pedidos: number;
  falta: number;
  pct: number;
}

interface LinhaRpi {
  responsavel: string;
  codigo: string;
  nome: string;
  previsto: number;
  realizado: number;
  pedidos: number;
}

const pctTxt = (pct: number): string => `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function Meta() {
  const { vendas, carregando: vendasCarregando, erro: vendasErro, recarregar } = useVendasCtx();
  const [equipe, setEquipe] = useState<Registro[]>([]);
  const [equipeErro, setEquipeErro] = useState<string | null>(null);
  const [equipeCarregando, setEquipeCarregando] = useState(true);

  const janela = useMemo(() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 26);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const br = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return { inicio: br(inicio), fim: br(fim) };
  }, []);

  useEffect(() => {
    let vivo = true;
    setEquipeCarregando(true);
    setEquipeErro(null);
    listarTudo('Equipe')
      .then((r) => {
        if (vivo) setEquipe(r.registros);
      })
      .catch((e) => {
        if (vivo) setEquipeErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setEquipeCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const { linhas, detalhes } = useMemo(() => {
    const linhasMeta: MetaLinha[] = [];
    const linhasRpi: LinhaRpi[] = [];

    // responsável (normalizado) → códigos de vendedor da aba Equipe
    const porResp = new Map<string, Set<string>>();
    for (const reg of equipe) {
      const resp = normalizarNome(reg['RESPONSAVEL']);
      const cod = String(reg['CODIGO'] ?? '').trim();
      if (resp === '' || cod === '') continue;
      if (!porResp.has(resp)) porResp.set(resp, new Set());
      porResp.get(resp)!.add(cod);
    }

    const ini = dataISO(janela.inicio);
    const fim = dataISO(janela.fim);

    const noPeriodo = (v: Venda): boolean => {
      if (!ehContabil(v)) return false;
      const iso = dataISO(campo(v, 'Data E-mail'));
      if (iso === '') return false;
      return iso >= ini && iso <= fim;
    };

    for (const def of META_DEFS) {
      const codigos = def.tipo === 'proprio' ? new Set<string>([String(def.codigo ?? '')]) : (porResp.get(normalizarNome(def.responsavel)) ?? new Set<string>());

      const acumulado = new Map<string, { valor: number; previsto: number; pedidos: number }>();
      let realizado = 0;
      let previsto = 0;
      let pedidos = 0;
      for (const v of vendas) {
        if (!noPeriodo(v)) continue;
        const cod = campo(v, 'COD. VENDEDOR');
        if (cod === '' || !codigos.has(cod)) continue;
        const a = acumulado.get(cod) ?? { valor: 0, previsto: 0, pedidos: 0 };
        a.valor += valorLiquido(v);
        a.previsto += valorFormulario(v);
        a.pedidos += 1;
        acumulado.set(cod, a);
        realizado += valorLiquido(v);
        previsto += valorFormulario(v);
        pedidos += 1;
      }

      const listaRpi = [...codigos].filter(Boolean);
      for (const cod of listaRpi) {
        const a = acumulado.get(cod) ?? { valor: 0, previsto: 0, pedidos: 0 };
        linhasRpi.push({
          responsavel: def.responsavel,
          codigo: cod,
          nome: (def.tipo === 'proprio' ? def.rpi : '') || `COD ${cod}`,
          previsto: a.previsto,
          realizado: a.valor,
          pedidos: a.pedidos,
        });
      }

      linhasMeta.push({
        responsavel: def.responsavel,
        meta: def.valor,
        nRpis: listaRpi.length,
        previsto,
        realizado,
        pedidos,
        falta: Math.max(0, def.valor - realizado),
        pct: def.valor > 0 ? (realizado / def.valor) * 100 : 0,
      });
    }
    return { linhas: linhasMeta, detalhes: linhasRpi };
  }, [equipe, vendas, janela]);

  if (vendasCarregando || equipeCarregando) return <div className="estado">Carregando metas da API…</div>;
  if (vendasErro || equipeErro) {
    return (
      <div className="estado">
        <p>Erro: {vendasErro ?? equipeErro}</p>
        <button
          onClick={() => {
            void recarregar();
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Meta</h2>
          <p>
            Janela de {janela.inicio} a {janela.fim} (calendário) • pelo campo Data E-mail • previsto = VALOR FORMULÁRIO
            (valor de tabela) • realizado = soma do Valor Líquido das vendas contábeis (com Nº Ped. e valor) de cada
            responsável • equipes conforme aba Equipe • metas definidas pelo gestor
          </p>
        </div>
      </div>

      <div className="painel">
        <table>
          <thead>
            <tr>
              <th>Responsável</th>
              <th className="direita">RPIs</th>
              <th className="direita">Meta</th>
              <th className="direita">Previsto</th>
              <th className="direita">Realizado</th>
              <th className="direita">% da meta</th>
              <th className="direita">Falta</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.responsavel}>
                <td>{l.responsavel}</td>
                <td className="direita">{numero(l.nRpis)}</td>
                <td className="direita">{moeda(l.meta)}</td>
                <td className="direita">{moeda(l.previsto)}</td>
                <td className="destaque">{moeda(l.realizado)}</td>
                <td className="direita">{pctTxt(l.pct)}</td>
                <td className="direita">{moeda(l.falta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="painel">
        <h3>Por RPI (no período da meta)</h3>
        <table>
          <thead>
            <tr>
              <th>Responsável</th>
              <th>RPI</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Previsto</th>
              <th className="direita">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {detalhes.map((d) => (
              <tr key={`${d.responsavel}-${d.codigo}`}>
                <td>{d.responsavel}</td>
                <td>{d.nome}</td>
                <td className="direita">{numero(d.pedidos)}</td>
                <td className="direita">{moeda(d.previsto)}</td>
                <td className="direita">{moeda(d.realizado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
