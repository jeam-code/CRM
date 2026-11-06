/**
 * Fechamento 2025 — leitura da planilha pública "Acompanhamento de RPIs 2025".
 *
 * A planilha tem 12 abas mensais (JANEIRO..DEZEMBRO) e é lida pelo navegador
 * direto do Google Sheets: sem backend, sem cópia local e sem dado fictício.
 *
 * IMPORTANTE — por que `export?format=csv&gid=` e não `gviz/tq`:
 * o gviz (`gviz/tq?tqx=out:csv&sheet=NOME`) descarta as linhas ocultas por
 * filtro da planilha. Em NOVEMBRO e DEZEMBRO isso escondia 55 dos 113 RPIs.
 * O endpoint `export` devolve a aba inteira (linhas ocultas inclusas).
 *
 * Os gids são lidos da URL ao abrir cada aba (`.../edit#gid=123`). Se uma aba
 * for recriada na planilha o gid muda — atualize ABAS_2025 nesse caso.
 */
import { MESES } from './config';
import { normalizarNome } from './format';

export const PLANILHA_2025_ID = '18QGMUUd3aKuqTtEqSF9BQbsRBnmE5wr4VIpS8RihcQw';
export const PLANILHA_2025_NOME = 'Acompanhamento de RPIs 2025';
export const PLANILHA_2025_URL = `https://docs.google.com/spreadsheets/d/${PLANILHA_2025_ID}/edit`;

export interface Aba2025 {
  /** Nome exato da aba na planilha. */
  mes: string;
  /** Rótulo curto exibido no seletor de mês. */
  curto: string;
  /** gid da aba (valor de `gid=` na URL ao abri-la). */
  gid: string;
}

export const ABAS_2025: readonly Aba2025[] = [
  { mes: 'JANEIRO', curto: 'Jan', gid: '1664467177' },
  { mes: 'FEVEREIRO', curto: 'Fev', gid: '349584480' },
  { mes: 'MARÇO', curto: 'Mar', gid: '2062132585' },
  { mes: 'ABRIL', curto: 'Abr', gid: '1667474521' },
  { mes: 'MAIO', curto: 'Mai', gid: '651118453' },
  { mes: 'JUNHO', curto: 'Jun', gid: '1121552363' },
  { mes: 'JULHO', curto: 'Jul', gid: '2019554341' },
  { mes: 'AGOSTO', curto: 'Ago', gid: '409313381' },
  { mes: 'SETEMBRO', curto: 'Set', gid: '1824734263' },
  { mes: 'OUTUBRO', curto: 'Out', gid: '343516362' },
  { mes: 'NOVEMBRO', curto: 'Nov', gid: '197066460' },
  { mes: 'DEZEMBRO', curto: 'Dez', gid: '226221386' },
];

/** Aba padrão: o mês corrente (mesma regra usada no restante do app). */
export function abaPadrao2025(): Aba2025 {
  const nome = MESES[new Date().getMonth()];
  return ABAS_2025.find((a) => a.mes === nome) ?? ABAS_2025[0];
}

export function urlAba2025(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${PLANILHA_2025_ID}/export?format=csv&gid=${gid}`;
}

/** Um RPI (linha do relatório mensal). `null` = célula sem valor ("-" ou vazia). */
export interface Linha2025 {
  equipe: string;
  codigo: string;
  ano: string;
  uf: string;
  vendedor: string;
  classe: string;
  /** Uma coluna por meta do mês (semanas, quinzenas ou OURO/PRATA/BRONZE). */
  metas: (number | null)[];
  /** Soma das metas — coluna "SOMA DAS METAS" quando existe. */
  somaMetas: number | null;
  /** Uma coluna por período de vendas do mês. */
  periodos: (number | null)[];
  /** "Total Mês" — conferido: sempre igual à soma dos períodos. */
  total: number | null;
  pctGeral: number | null;
  cota: number | null;
  pctProp: number | null;
  /** Colunas extras da planilha (VELA 10, PROMO2, COMISSÃO, PRÊMIO…). */
  extras: (number | null)[];
}

export interface Totais2025 {
  rpis: number;
  metas: (number | null)[];
  somaMetas: number | null;
  periodos: (number | null)[];
  total: number | null;
  /** Vendas ÷ soma das metas — mesma base do "ALCANCE - GERAL" da planilha. */
  pctGeral: number | null;
  cota: number | null;
  pctProp: number | null;
  extras: (number | null)[];
}

export interface ResumoEquipe2025 {
  equipe: string;
  rpis: number;
  metas: number | null;
  vendas: number | null;
  pctGeral: number | null;
}

export interface Fechamento2025 {
  mes: string;
  rotulos: { metas: string[]; periodos: string[]; extras: string[] };
  linhas: Linha2025[];
  totais: Totais2025;
  equipes: ResumoEquipe2025[];
}

/** Totais de um mês dentro do consolidado anual. */
export interface MesConsolidado2025 {
  mes: string;
  curto: string;
  rpis: number;
  metas: number | null;
  vendas: number | null;
  cota: number | null;
  pctGeral: number | null;
  pctProp: number | null;
}

/** Um RPI somado nos 12 meses (agrupado por vendedor). */
export interface RpiConsolidado2025 {
  equipe: string;
  codigo: string;
  vendedor: string;
  uf: string;
  classe: string;
  /** Em quantos meses esse RPI apareceu. */
  meses: number;
  metas: number | null;
  vendas: number | null;
  cota: number | null;
  pctGeral: number | null;
  pctProp: number | null;
}

/** Visão "Todos os meses": 12 abas somadas. */
export interface Consolidado2025 {
  meses: MesConsolidado2025[];
  rpis: RpiConsolidado2025[];
  equipes: ResumoEquipe2025[];
  totais: {
    rpis: number;
    metas: number | null;
    vendas: number | null;
    cota: number | null;
    pctGeral: number | null;
    pctProp: number | null;
  };
}

/** Converte texto no formato brasileiro ("R$ 1.234,56", "12,5%", "R$ -") em número. */
export function numeroBr(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  let s = String(valor).trim();
  if (s === '') return null;
  s = s.replace(/R\$/gi, '').replace(/\s/g, '').replace(/%/g, '');
  if (s === '' || /^[-–—.]+$/.test(s)) return null;
  const negativo = s.startsWith('-');
  if (negativo) s = s.slice(1);
  if (!/\d/.test(s)) return null;
  const virgula = s.includes(',');
  const ponto = s.includes('.');
  if (virgula && ponto) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (virgula) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (ponto) {
    const partes = s.split('.');
    // "622.000" = milhar; "28.07" continua decimal.
    if (partes.length > 1 && partes.slice(1).every((p) => p.length === 3)) s = partes.join('');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Parser CSV (RFC 4180) — aspas duplas escapadas com "" e quebras LF/CRLF. */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let atual = '';
  let emAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          emAspas = false;
        }
      } else {
        atual += c;
      }
    } else if (c === '"') {
      emAspas = true;
    } else if (c === ',') {
      linha.push(atual);
      atual = '';
    } else if (c === '\n') {
      linha.push(atual);
      atual = '';
      linhas.push(linha);
      linha = [];
    } else if (c !== '\r') {
      atual += c;
    }
  }
  if (atual !== '' || linha.length > 0) {
    linha.push(atual);
    linhas.push(linha);
  }
  return linhas;
}

const txt = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
/** Cabeçalho normalizado: minúsculo, sem acento de espaço e sem espaços repetidos. */
const norm = (v: unknown): string => txt(v).toLowerCase().replace(/\s+/g, ' ');

const achar = (cab: string[], teste: (h: string) => boolean): number =>
  cab.findIndex((h) => teste(norm(h)));

/** Soma apenas os valores presentes; `null` quando nenhum valor existe. */
const somar = (valores: (number | null)[]): number | null => {
  const presentes = valores.filter((v): v is number => v !== null);
  return presentes.length > 0 ? presentes.reduce((a, b) => a + b, 0) : null;
};

const FETCH_TIMEOUT_MS = 25000;

async function baixarCsv(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Planilha respondeu HTTP ${res.status}`);
    const texto = await res.text();
    if (/^\s*</.test(texto)) throw new Error('A planilha não está mais pública ou o gid mudou');
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

/** Monta o fechamento de uma aba a partir do CSV bruto. */
function montarFechamento(mes: string, csv: string): Fechamento2025 {
  const bruto = parseCsv(csv);
  if (bruto.length < 2) throw new Error(`A aba ${mes} veio vazia`);

  const cab = bruto[0];
  const idxTotal = achar(cab, (h) => h === 'total mês');
  if (idxTotal < 0) throw new Error(`Aba ${mes}: coluna "Total Mês" não encontrada`);
  const idxSoma = achar(cab, (h) => h === 'soma das metas');
  const idxPctG = achar(cab, (h) => h.startsWith('% de alcance da cota geral'));
  const idxCota = achar(cab, (h) => h.startsWith('cota proporcional'));
  const idxPctP = achar(cab, (h) => h.startsWith('% de alcance da cota proporcional'));

  // Colunas de meta: começam na 7ª (índice 6) e vão até "SOMA DAS METAS" (ou até Total).
  const limiteMeta = idxSoma >= 0 ? idxSoma : idxTotal;
  const idxMetas = cab
    .map((_, i) => i)
    .filter((i) => i >= 6 && i < limiteMeta && /^meta/i.test(norm(cab[i])));

  // Colunas de período: entre a última meta (ou a soma) e "Total Mês".
  const inicioPeriodo =
    idxSoma >= 0 ? idxSoma + 1 : idxMetas.length > 0 ? Math.max(...idxMetas) + 1 : 6;
  const idxPeriodos = cab
    .map((_, i) => i)
    .filter((i) => i >= inicioPeriodo && i < idxTotal && norm(cab[i]) !== '' && !/^-+$/.test(norm(cab[i])));

  // Colunas extras: depois do último "% de alcance".
  const inicioExtra = idxPctP >= 0 ? idxPctP + 1 : idxTotal + 1;
  const idxExtras = cab
    .map((_, i) => i)
    .filter((i) => i >= inicioExtra && i < cab.length && norm(cab[i]) !== '' && !/^-+$/.test(norm(cab[i])));

  const linhas: Linha2025[] = [];
  for (let i = 1; i < bruto.length; i++) {
    const r = bruto[i];
    // Linha de RPI: tem equipe (FB/SG) e vendedor. O bloco de resumo vem depois
    // e não tem equipe na 1ª coluna.
    if (txt(r[0]) === '' || txt(r[4]) === '') continue;

    const metas = idxMetas.map((c) => numeroBr(r[c]));
    const somaDireta = idxSoma >= 0 ? numeroBr(r[idxSoma]) : null;
    const periodos = idxPeriodos.map((c) => numeroBr(r[c]));
    const totalDireto = numeroBr(r[idxTotal]);

    linhas.push({
      equipe: txt(r[0]),
      codigo: txt(r[1]),
      ano: txt(r[2]),
      uf: txt(r[3]),
      vendedor: txt(r[4]),
      classe: txt(r[5]),
      metas,
      somaMetas: somaDireta ?? somar(metas),
      periodos,
      total: totalDireto ?? somar(periodos),
      pctGeral: idxPctG >= 0 ? numeroBr(r[idxPctG]) : null,
      cota: idxCota >= 0 ? numeroBr(r[idxCota]) : null,
      pctProp: idxPctP >= 0 ? numeroBr(r[idxPctP]) : null,
      extras: idxExtras.map((c) => numeroBr(r[c])),
    });
  }

  if (linhas.length === 0) throw new Error(`Aba ${mes}: nenhum RPI encontrado`);

  const totais: Totais2025 = {
    rpis: linhas.length,
    metas: idxMetas.map((_, j) => somar(linhas.map((l) => l.metas[j] ?? null))),
    somaMetas: somar(linhas.map((l) => l.somaMetas)),
    periodos: idxPeriodos.map((_, j) => somar(linhas.map((l) => l.periodos[j] ?? null))),
    total: somar(linhas.map((l) => l.total)),
    pctGeral: null,
    cota: somar(linhas.map((l) => l.cota)),
    pctProp: null,
    extras: idxExtras.map((_, j) => somar(linhas.map((l) => l.extras[j] ?? null))),
  };
  totais.pctGeral = totais.somaMetas && totais.somaMetas > 0 && totais.total !== null
    ? (totais.total / totais.somaMetas) * 100
    : null;
  totais.pctProp = totais.cota && totais.cota > 0 && totais.total !== null
    ? (totais.total / totais.cota) * 100
    : null;

  const equipes: ResumoEquipe2025[] = [];
  for (const l of linhas) {
    let e = equipes.find((x) => x.equipe === l.equipe);
    if (!e) {
      e = { equipe: l.equipe, rpis: 0, metas: null, vendas: null, pctGeral: null };
      equipes.push(e);
    }
    e.rpis += 1;
    e.metas = somar([e.metas, l.somaMetas]);
    e.vendas = somar([e.vendas, l.total]);
  }
  for (const e of equipes) {
    e.pctGeral = e.metas !== null && e.metas > 0 && e.vendas !== null ? (e.vendas / e.metas) * 100 : null;
  }

  return {
    mes,
    rotulos: {
      metas: idxMetas.map((c) => txt(cab[c])),
      periodos: idxPeriodos.map((c) => txt(cab[c])),
      extras: idxExtras.map((c) => txt(cab[c])),
    },
    linhas,
    totais,
    equipes,
  };
}

/** Cache por aba: trocar de mês não baixa o CSV de novo. */
const cache = new Map<string, Promise<Fechamento2025>>();

export function buscarFechamento2025(aba: Aba2025): Promise<Fechamento2025> {
  const existente = cache.get(aba.gid);
  if (existente) return existente;
  const promessa = baixarCsv(urlAba2025(aba.gid))
    .then((csv) => montarFechamento(aba.mes, csv))
    .catch((e) => {
      cache.delete(aba.gid); // não fica em cache uma falha transitória
      throw e instanceof Error ? e : new Error(String(e));
    });
  cache.set(aba.gid, promessa);
  return promessa;
}

/** Alguns RPIs aparecem com o mesmo vendedor em vários meses — agrupa por nome. */
function consolidarFechamento(abas: Fechamento2025[]): Consolidado2025 {
  const meses: MesConsolidado2025[] = abas.map((a, i) => ({
    mes: a.mes,
    curto: ABAS_2025[i]?.curto ?? a.mes.slice(0, 3),
    rpis: a.totais.rpis,
    metas: a.totais.somaMetas,
    vendas: a.totais.total,
    cota: a.totais.cota,
    pctGeral: a.totais.pctGeral,
    pctProp: a.totais.pctProp,
  }));

  const porVendedor = new Map<string, RpiConsolidado2025>();
  const porEquipe = new Map<string, ResumoEquipe2025>();
  let totalRpis = 0;

  for (const a of abas) {
    for (const l of a.linhas) {
      totalRpis += 1;

      const chave = normalizarNome(l.vendedor) || l.codigo;
      const existente = porVendedor.get(chave);
      if (existente) {
        existente.meses += 1;
        existente.metas = somar([existente.metas, l.somaMetas]);
        existente.vendas = somar([existente.vendas, l.total]);
        existente.cota = somar([existente.cota, l.cota]);
      } else {
        porVendedor.set(chave, {
          equipe: l.equipe,
          codigo: l.codigo,
          vendedor: l.vendedor,
          uf: l.uf,
          classe: l.classe,
          meses: 1,
          metas: l.somaMetas,
          vendas: l.total,
          cota: l.cota,
          pctGeral: null,
          pctProp: null,
        });
      }

      let equipe = porEquipe.get(l.equipe);
      if (!equipe) {
        equipe = { equipe: l.equipe, rpis: 0, metas: null, vendas: null, pctGeral: null };
        porEquipe.set(l.equipe, equipe);
      }
      equipe.rpis += 1;
      equipe.metas = somar([equipe.metas, l.somaMetas]);
      equipe.vendas = somar([equipe.vendas, l.total]);
    }
  }

  const rpis = [...porVendedor.values()];
  for (const r of rpis) {
    r.pctGeral = r.metas !== null && r.metas > 0 && r.vendas !== null ? (r.vendas / r.metas) * 100 : null;
    r.pctProp = r.cota !== null && r.cota > 0 && r.vendas !== null ? (r.vendas / r.cota) * 100 : null;
  }

  const equipes = [...porEquipe.values()];
  for (const e of equipes) {
    e.pctGeral = e.metas !== null && e.metas > 0 && e.vendas !== null ? (e.vendas / e.metas) * 100 : null;
  }

  const metas = somar(meses.map((m) => m.metas));
  const vendas = somar(meses.map((m) => m.vendas));
  const cota = somar(meses.map((m) => m.cota));

  return {
    meses,
    rpis,
    equipes,
    totais: {
      rpis: totalRpis,
      metas,
      vendas,
      cota,
      pctGeral: metas !== null && metas > 0 && vendas !== null ? (vendas / metas) * 100 : null,
      pctProp: cota !== null && cota > 0 && vendas !== null ? (vendas / cota) * 100 : null,
    },
  };
}

/** Cache do consolidado anual (as 12 abas, já em cache individualmente). */
let cacheTodos: Promise<Consolidado2025> | null = null;

/** Botão "Atualizar": zera os caches para reler a planilha. */
export function limparCacheFechamento2025(): void {
  cache.clear();
  cacheTodos = null;
}

/** Fechamento "Todos os meses": busca as 12 abas e soma. */
export function buscarTodosFechamento2025(): Promise<Consolidado2025> {
  if (!cacheTodos) {
    cacheTodos = Promise.all(ABAS_2025.map((a) => buscarFechamento2025(a)))
      .then(consolidarFechamento)
      .catch((e) => {
        cacheTodos = null; // falha transitória não fica em cache
        throw e instanceof Error ? e : new Error(String(e));
      });
  }
  return cacheTodos;
}
