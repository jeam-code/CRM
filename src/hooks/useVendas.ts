import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarAbas, listarTudo, type Registro } from '../lib/api';
import { NOMES_MESES_ANO, eNomeDeMes } from '../lib/config';
import { normalizarNome } from '../lib/format';
import type { Venda } from '../lib/domain';

interface Estado {
  vendas: Venda[];
  campos: string[];
  total: number;
  /** Meses carregados com sucesso. */
  mesesOk: string[];
  /** Meses que falharam (timeout da API). */
  mesesErro: string[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  atualizandoLinhas: Set<number>;
  marcarAtualizando: (linha: number, ativa: boolean) => void;
}

/** Normaliza cabeçalhos que variam entre meses para os nomes padrão do app. */
export function normalizarRegistro(campos: string[], reg: Record<string, unknown>): Record<string, unknown> {
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const regras: [string, RegExp][] = [
    ['Data Lançamento', /data.*lan[çc]/],
    ['Nº Ped.', /ped/],
    ['Valor Líquido', /valor.*l[ií]q/],
    ['Novos Clientes', /novos/],
    ['Cliente', /^cliente$/],
    ['CNPJ', /cnpj/],
    ['UF', /^uf$/],
    ['COD. VENDEDOR', /vendedor|cod/],
    ['RPI', /rpi/],
    ['VELA8', /vela/],
    ['PROMO2', /promo/],
    ['SAZONAL', /sazon/],
  ];
  const normCampos = campos.map(norm);
  const saida = { ...reg };
  for (const [padrao, re] of regras) {
    if (saida[padrao] !== undefined && String(saida[padrao] ?? '').trim() !== '') continue;
    const i = normCampos.findIndex((c) => re.test(c));
    if (i !== -1 && campos[i] !== padrao) saida[padrao] = reg[campos[i]];
  }
  return saida;
}

/** Carrega as abas mensais da planilha mestre — única fonte de dados do app.
 *  A lista de meses vem da própria planilha (action=abas): aba nova (NOVEMBRO/DEZEMBRO)
 *  entra sem alterar o app; abas que falharem (timeout) são marcadas em mesesErro. */
export function useVendas(): Estado {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [campos, setCampos] = useState<string[]>([]);
  const [mesesOk, setMesesOk] = useState<string[]>([]);
  const [mesesErro, setMesesErro] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizandoLinhas, setAtualizando] = useState<Set<number>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const abasReais = await listarAbas();
      const ordemMes = new Map<string, number>((NOMES_MESES_ANO as readonly string[]).map((m, i) => [normalizarNome(m), i]));
      const meses = abasReais
        .filter((a) => eNomeDeMes(a))
        .sort((a, b) => (ordemMes.get(normalizarNome(a)) ?? 99) - (ordemMes.get(normalizarNome(b)) ?? 99));
      const resultados = await Promise.allSettled(meses.map((mes) => listarTudo(mes)));
      const todas: Venda[] = [];
      const ok: string[] = [];
      const falhas: string[] = [];
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          ok.push(meses[i]);
          if (i === 0) setCampos(r.value.campos);
          const campos = r.value.campos;
          for (const reg of r.value.registros) {
            const norm = normalizarRegistro(campos, reg as Record<string, unknown>);
            const primeiras = campos.slice(0, 4).map((c) => {
              const val = (reg as Record<string, unknown>)[c];
              return val === null || val === undefined ? '' : String(val);
            });
            todas.push({ ...norm, _mes: meses[i], _primeiras: primeiras } as Venda);
          }
        } else {
          falhas.push(meses[i]);
        }
      });
      setVendas(todas);
      setMesesOk(ok);
      setMesesErro(falhas);
      if (ok.length === 0) setErro('Nenhum mês pôde ser lido na API.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const marcarAtualizando = useCallback((linha: number, ativa: boolean) => {
    setAtualizando((atual) => {
      const prox = new Set(atual);
      if (ativa) prox.add(linha);
      else prox.delete(linha);
      return prox;
    });
  }, []);

  const total = useMemo(() => vendas.length, [vendas]);

  return useMemo(
    () => ({ vendas, campos, total, mesesOk, mesesErro, carregando, erro, recarregar: carregar, atualizandoLinhas, marcarAtualizando }),
    [vendas, campos, total, mesesOk, mesesErro, carregando, erro, carregar, atualizandoLinhas, marcarAtualizando],
  );
}

export type { Registro };
