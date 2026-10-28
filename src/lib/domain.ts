/**
 * Camada de domínio — deriva Clientes, Oportunidades, Atividades e Equipe
 * exclusivamente dos registros reais da aba VENDAS (e Metas).
 *
 * Regras apuradas na planilha real (out/2026):
 * - Linhas 100% vazias (sem Cliente/CNPJ/pedido/valores) são IGNORADAS em tudo.
 * - C/N = tipo de cliente: C = cliente base, N = novo. NÃO é etapa de funil.
 * - VALOR FORMULÁRIO carrega marcadores: "CANCELADO", "BONIFICAÇÃO", "EXPOSITOR".
 * - "Data Lançamento" pode conter texto de status ("Aguardo co…", "CDL Consta")
 *   em vez de data — essas linhas com cliente entram em "Aguardando lançamento".
 * - Cancelados são excluídos de receita, ticket, tops e série diária, e aparecem
 *   em card próprio (quantidade + valor).
 */
import type { Registro } from './api';
import { numeroOuZero } from './format';

export interface Venda extends Registro {
  _linha: number;
  /** Aba mensal de origem (JANEIRO..OUTUBRO). Preenchido pelo carregamento. */
  _mes: string;
  /** Valores crus das 4 primeiras colunas (posição) — para achar marcadores. */
  _primeiras?: string[];
}

export const campo = (v: Venda, nome: string): string => {
  const val = v[nome];
  return val === null || val === undefined ? '' : String(val).trim();
};

export const valorLiquido = (v: Venda): number => numeroOuZero(v['Valor Líquido']);

/** Valor de tabela (bruto) da linha — usado como previsão, nunca somado como receita. */
export const valorFormulario = (v: Venda): number => numeroOuZero(v['VALOR FORMULÁRIO']);

/** Texto cru da célula Valor Líquido (pode ser número ou marcador como CANCELADO). */
function vlTexto(v: Venda): string {
  const raw = v['Valor Líquido'];
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

/** Valor Líquido é numérico (não texto/marcador)? */
export function vlNumerico(v: Venda): boolean {
  const s = vlTexto(v);
  if (s === '') return false;
  return Number.isFinite(Number(s));
}

export type Marcador = 'cancelado' | 'expositor' | 'bonificacao' | 'troca' | 'outro' | null;

/**
 * Marcador da linha. A marcação varia muito na planilha:
 * - no Valor Líquido (ex.: "CANCELADO");
 * - no nome do Cliente (ex.: "BONIFICAÇÃO - LOJA X", "TROCA - MIX TUDO", "(EXPOSITOR VENDIDO)");
 * - em qualquer das 4 primeiras colunas (cada mês guarda de um jeito).
 * As regras são estritas para não confundir nomes próprios ("JOSE BONIFACIO")
 * nem a feira "EXPOSUL".
 */
export function marcador(v: Venda): Marcador {
  const fontes: string[] = Array.isArray(v._primeiras) && v._primeiras.length > 0
    ? v._primeiras.map((x) => String(x ?? ''))
    : [vlTexto(v), campo(v, 'VALOR FORMULÁRIO')];
  const t = [...fontes, campo(v, 'Cliente')].join(' ').toLowerCase();
  if (t.includes('cancel')) return 'cancelado';
  if (t.includes('expositor')) return 'expositor';
  if (/bonifica[cç][aã]o/.test(t)) return 'bonificacao';
  if (/\btroca\b/.test(t)) return 'troca';
  // Texto desconhecido só conta como marcador se estiver no próprio Valor Líquido
  if (vlTexto(v) !== '' && !vlNumerico(v)) return 'outro';
  return null;
}

/**
 * Regra contábil: só entra na conta o lançamento com Nº Ped. E Valor Líquido
 * numérico preenchidos E sem marcador (cancelado/bonificação/expositor/troca
 * nunca somam receita). É por isso que o total das abas converge para o
 * "valor final" do relatório mensal.
 */
export function ehContabil(v: Venda): boolean {
  return campo(v, 'Nº Ped.') !== '' && vlNumerico(v) && marcador(v) === null;
}

export function ehCancelada(v: Venda): boolean {
  return marcador(v) === 'cancelado';
}

export function ehBonificacao(v: Venda): boolean {
  return marcador(v) === 'bonificacao';
}

export function ehExpositor(v: Venda): boolean {
  return marcador(v) === 'expositor';
}

/** Linha com algum conteúdo (exclui linhas em branco da planilha). */
export function ehLinhaValida(v: Venda): boolean {
  return ['Cliente', 'CNPJ', 'Nº Ped.', 'Valor Líquido', 'RPI', 'Novos Clientes'].some((c) => campo(v, c) !== '');
}

/** CNPJ só com dígitos — referência de agrupamento (menos erro que nome). */
export function cnpjDigitos(v: Venda): string {
  return campo(v, 'CNPJ').replace(/\D/g, '');
}
/** Tipo de cliente pela coluna "Novos Clientes": C = base, N = novo. */
export function tipoCliente(v: Venda): 'C' | 'N' | '' {
  const t = (campo(v, 'Novos Clientes') || campo(v, 'C/N')).toUpperCase();
  return t === 'C' || t === 'N' ? t : '';
}

/** Data de lançamento válida (a coluna às vezes traz texto de status). */
export function dataLancamentoValida(v: Venda): string {
  const raw = campo(v, 'Data Lançamento');
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : raw;
}

/** Aguardando lançamento: tem conteúdo, mas ainda sem Nº Ped. ou valor numérico (entra depois). */
export function ehAguardando(v: Venda): boolean {
  if (!ehLinhaValida(v) || marcador(v) !== null) return false;
  if (!campo(v, 'Cliente')) return false;
  return !ehContabil(v);
}

/* ------------------------------ Clientes ------------------------------ */

export interface Cliente {
  chave: string;
  nome: string;
  cnpj: string;
  uf: string;
  responsavel: string;
  rpi: string;
  pedidos: number;
  receita: number;
  ultimoLancamento: string;
  /** Linha representativa na planilha (primeira ocorrência) — usada p/ editar/excluir via API. */
  linhaReferencia: number;
}

export function derivarClientes(vendas: Venda[]): Cliente[] {
  const mapa = new Map<string, Cliente>();
  for (const v of vendas) {
    // Marcadores (bonificação/expositor/cancelado/troca) não formam cliente/venda.
    if (!ehLinhaValida(v) || marcador(v) !== null) continue;
    const nome = campo(v, 'Cliente') || '(sem nome)';
    const cnpj = campo(v, 'CNPJ');
    const dig = cnpj.replace(/\D/g, '');
    const chave = dig ? `cnpj:${dig}` : `nome:${nome.toLowerCase()}`;
    const atual = mapa.get(chave);
    const contabil = ehContabil(v);
    const dt = contabil ? dataLancamentoValida(v) : '';
    const vl = contabil ? valorLiquido(v) : 0;
    if (!atual) {
      mapa.set(chave, {
        chave,
        nome,
        cnpj,
        uf: campo(v, 'UF'),
        responsavel: campo(v, 'RESP.'),
        rpi: campo(v, 'RPI'),
        pedidos: contabil ? 1 : 0,
        receita: vl,
        ultimoLancamento: dt,
        linhaReferencia: v._linha,
      });
    } else {
      if (contabil) atual.pedidos += 1;
      atual.receita += vl;
      if (!atual.uf) atual.uf = campo(v, 'UF');
      if (!atual.responsavel) atual.responsavel = campo(v, 'RESP.');
      if (!atual.rpi) atual.rpi = campo(v, 'RPI');
      if (dt && (!atual.ultimoLancamento || dt > atual.ultimoLancamento)) atual.ultimoLancamento = dt;
    }
  }
  return [...mapa.values()].sort((a, b) => b.receita - a.receita);
}

/* ---------------------------- Oportunidades ---------------------------- */

export type Segmento = 'clientes' | 'novos' | 'sem_classificacao';

export const SEGMENTOS: { id: Segmento; titulo: string; descricao: string }[] = [
  { id: 'novos', titulo: 'Novos', descricao: 'C/N = N' },
  { id: 'clientes', titulo: 'Clientes base', descricao: 'C/N = C' },
  { id: 'sem_classificacao', titulo: 'Sem classificação', descricao: 'sem C/N' },
];

/**
 * A planilha não tem campo de etapa de funil (Confirmação/OS/Data estão vazios).
 * O Kanban agrupa por tipo de cliente (C/N) em modo leitura — mover cards entre
 * colunas alteraria o tipo do cliente, por isso a troca de coluna está desativada.
 */
export function segmentoDe(v: Venda): Segmento {
  const t = tipoCliente(v);
  if (t === 'N') return 'novos';
  if (t === 'C') return 'clientes';
  return 'sem_classificacao';
}

export interface Oportunidade {
  id: string;
  venda: Venda;
  titulo: string;
  cliente: string;
  valor: number;
  segmento: Segmento;
  rpi: string;
  uf: string;
  numeroPedido: string;
  cancelada: boolean;
  marcador: Marcador;
}

export function derivarOportunidades(vendas: Venda[]): Oportunidade[] {
  // Marcadores não são oportunidades: ficam fora do Kanban.
  return vendas.filter((v) => ehLinhaValida(v) && marcador(v) === null).map((v) => ({
    id: String(v._linha),
    venda: v,
    titulo: campo(v, 'Cliente') || `Pedido ${campo(v, 'Nº Ped.') || v._linha}`,
    cliente: campo(v, 'Cliente'),
    valor: valorLiquido(v),
    segmento: segmentoDe(v),
    rpi: campo(v, 'RPI'),
    uf: campo(v, 'UF'),
    numeroPedido: campo(v, 'Nº Ped.'),
    cancelada: ehCancelada(v),
    marcador: marcador(v),
  }));
}

/* ----------------------------- Atividades ------------------------------ */

export interface Atividade {
  id: string;
  venda: Venda;
  titulo: string;
  responsavel: string;
  rpi: string;
  tipo: string;
  status: string;
  data: string;
  valor: number;
}

function statusDe(v: Venda): string {
  const m = marcador(v);
  if (m === 'cancelado') return 'Cancelado';
  if (m === 'bonificacao') return 'Bonificação';
  if (m === 'expositor') return 'Expositor';
  if (m === 'troca') return 'Troca';
  if (m === 'outro') return 'Marcador';
  const t = tipoCliente(v);
  if (t === 'C') return 'Cliente base (C)';
  if (t === 'N') return 'Novo (N)';
  return 'Sem classificação';
}

function tipoDe(v: Venda): string {
  const flags = [campo(v, 'Emp.'), campo(v, 'VELA8'), campo(v, 'PROMO2'), campo(v, 'SAZONAL')].filter(Boolean);
  return flags.length > 0 ? flags.join(' • ') : 'Pedido';
}

/** Converte dd/mm/aaaa em aaaa-mm-dd para comparar com inputs de data. */
export function isoDeBR(br: string): string {
  const p = br.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}

export function derivarAtividades(vendas: Venda[]): Atividade[] {
  // Marcadores (bonificação/expositor/cancelado/troca) não entram como atividade.
  return vendas.filter((v) => ehLinhaValida(v) && marcador(v) === null).map((v) => ({
    id: String(v._linha),
    venda: v,
    titulo: `${campo(v, 'Cliente') || 'Pedido'} — ${campo(v, 'Nº Ped.') ? `Ped. ${campo(v, 'Nº Ped.')}` : `linha ${v._linha}`}`,
    responsavel: campo(v, 'RESP.') || campo(v, 'RPI') || '—',
    rpi: campo(v, 'RPI'),
    tipo: tipoDe(v),
    status: statusDe(v),
    data: dataLancamentoValida(v) || campo(v, 'Data E-mail'),
    valor: valorLiquido(v),
  }));
}

/* --------------------------- Resumo Diário --------------------------- */

export interface DiaResumo {
  dia: number;
  valor: number;
}

export interface ResumoDiario {
  dias: DiaResumo[];
  total: number;
  ticketMedio: number;
  diasComMovimento: number;
  colunaValor: string;
}

/**
 * Lê a aba RESUMO DIÁRIO (relatório visual, sem cabeçalho padrão).
 * Regras: só entram linhas cuja coluna A ("z") tenha dia 1–31; o valor vem da
 * primeira coluna nomeada com conteúdo numérico (ex.: E1 = "Valor").
 * A coluna "" (última, sem nome) é ignorada de propósito.
 */
export function resumirDiario(registros: Registro[]): ResumoDiario | null {
  if (registros.length === 0) return null;
  const chaves = Object.keys(registros[0]).filter((k) => k !== '_linha' && k !== 'z' && k !== '');
  const colunaValor = chaves.find((k) =>
    registros.some((r) => {
      const n = Number(r[k]);
      return r[k] !== '' && r[k] !== null && r[k] !== undefined && Number.isFinite(n) && n !== 0;
    }),
  );
  if (!colunaValor) return null;
  const dias: DiaResumo[] = [];
  for (const r of registros) {
    const dia = Number(r['z']);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) continue;
    dias.push({ dia, valor: numeroOuZero(r[colunaValor]) });
  }
  if (dias.length === 0) return null;
  dias.sort((a, b) => a.dia - b.dia);
  const total = dias.reduce((s, d) => s + d.valor, 0);
  const comMov = dias.filter((d) => d.valor > 0).length;
  return { dias, total, ticketMedio: comMov > 0 ? total / comMov : 0, diasComMovimento: comMov, colunaValor };
}

/* ------- Resumo mensal via "Cópia de <MÊS>" (relatório visual) ------- */

const eDataBR = (s: string): boolean => /^\d{2}\/\d{2}\/\d{4}$/.test((s ?? '').trim());

function parseBlocoCopia(texto: string[][], cabecalho: string): BlocoResumo[] {
  const itens: BlocoResumo[] = [];
  // Blocos em F–H (índices 5–7): nome | qtd | valor (coluna única)
  const idx = texto.findIndex((r) => (r[5] ?? '').trim().toUpperCase() === cabecalho);
  if (idx === -1) return itens;
  for (let i = idx + 1; i < texto.length; i++) {
    const r = texto[i];
    const nome = (r[5] ?? '').trim();
    if (nome.toUpperCase().startsWith('RESUMO')) break;
    if (nome === '') break; // linha de total ou fim do bloco
    if (!eNum(r[6] ?? '')) break;
    itens.push({ nome, qtd: moedaBR(r[6]), valor: moedaBR(r[7]), valorFinal: moedaBR(r[7]) });
  }
  return itens;
}

/**
 * Layout ANTIGO da aba "Cópia de <MÊS>" (fallback):
 * diário em A–E, aguardando na linha "AGUARDANDO LANÇAMENTO" (F–H),
 * totais/ticket/rodapé por rótulo na coluna A, blocos em F–H (sem valor final).
 */
function parseResumoLegado(texto: string[][]): ResumoGeral | null {
  if (!texto || texto.length === 0) return null;

  const idxData = texto.findIndex((r) => (r[0] ?? '').trim().toUpperCase() === 'DATA');
  if (idxData === -1) return null;

  const diario: LinhaDiaria[] = [];
  let tot: string[] = [];
  for (let i = idxData + 1; i < texto.length; i++) {
    const r = texto[i];
    if (eDataBR(r[0] ?? '')) {
      diario.push({
        data: (r[0] ?? '').trim(),
        qtde: moedaBR(r[1]),
        lancados: moedaBR(r[2]),
        valor: moedaBR(r[3]),
        valorFinal: moedaBR(r[4]),
      });
      continue;
    }
    if ((r[0] ?? '').trim() === '' && eNum(r[1] ?? '')) {
      tot = r;
      break;
    }
    if ((r[0] ?? '').trim() !== '') break;
  }
  if (diario.length === 0 || tot.length === 0) return null;

  const num = (r: string[] | undefined, c: number): number => moedaBR(r?.[c]);
  const linhaDe = (rotulo: string): string[] | undefined =>
    texto.find((r) => (r[0] ?? '').trim().toUpperCase() === rotulo);
  const tick = linhaDe('TICKET MÉDIO') ?? texto.find((r) => (r[0] ?? '').trim().toUpperCase().startsWith('TICKET'));
  const canc = linhaDe('CANCELADO');
  const bon = linhaDe('BONIFICAÇÃO');
  const exp = linhaDe('EXPOSITOR');
  const aga = texto.find((r) => (r[5] ?? '').trim().toUpperCase().startsWith('AGUARDANDO'));

  return {
    diario,
    totalQtde: num(tot, 1),
    totalLancados: num(tot, 2),
    totalValor: num(tot, 3),
    totalFinal: num(tot, 4),
    ticketValor: num(tick, 3),
    ticketFinal: num(tick, 4),
    cancelQtd: num(canc, 3),
    cancelValor: num(canc, 4),
    bonifQtd: num(bon, 3),
    bonifValor: num(bon, 4),
    exposQtd: num(exp, 3),
    exposValor: num(exp, 4),
    aguardQtd: aga ? moedaBR(aga[6]) : 0,
    aguardValor: aga ? moedaBR(aga[7]) : 0,
    gestores: parseBlocoCopia(texto, 'GERENTE'),
    clientes: parseBlocoCopia(texto, 'CLIENTES'),
    empresas: parseBlocoCopia(texto, 'EMPRESA'),
  };
}

/** Converte " R$  3.193,96 " / "1.168" / "-" em número. */
export function moedaBR(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const s = String(valor ?? '').trim();
  if (s === '' || s === '-' || s === 'R$') return 0;
  const limpo = s.replace(/R\$/g, '').replace(/%/g, '').trim();
  if (limpo === '' || limpo === '-') return 0;
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export interface LinhaDiaria {
  data: string;
  qtde: number;
  lancados: number;
  valor: number;
  valorFinal: number;
}

export interface BlocoResumo {
  nome: string;
  qtd: number;
  valor: number;
  valorFinal: number;
}

export interface ResumoGeral {
  diario: LinhaDiaria[];
  totalQtde: number;
  totalLancados: number;
  totalValor: number;
  totalFinal: number;
  ticketValor: number;
  ticketFinal: number;
  cancelQtd: number;
  cancelValor: number;
  bonifQtd: number;
  bonifValor: number;
  exposQtd: number;
  exposValor: number;
  aguardQtd: number;
  aguardValor: number;
  gestores: BlocoResumo[];
  clientes: BlocoResumo[];
  empresas: BlocoResumo[];
}

const eNum = (s: string): boolean => s.trim() !== '' && Number.isFinite(Number(s.trim()));

function parseBloco(texto: string[][], cabecalho: string): { itens: BlocoResumo[]; total: BlocoResumo | null } {
  const itens: BlocoResumo[] = [];
  let total: BlocoResumo | null = null;
  // Blocos em H–K (índices 7–10): nome | qtd | valor | valor final
  const idx = texto.findIndex((r) => (r[7] ?? '').trim().toUpperCase() === cabecalho);
  if (idx === -1) return { itens, total };
  for (let i = idx + 1; i < texto.length; i++) {
    const r = texto[i];
    const nome = (r[7] ?? '').trim();
    if (nome.toUpperCase().startsWith('RESUMO')) break;
    if (nome === '') {
      if (eNum(r[8] ?? '')) {
        total = { nome: 'TOTAL', qtd: moedaBR(r[8]), valor: moedaBR(r[9]), valorFinal: moedaBR(r[10]) };
      }
      break;
    }
    if (!eNum(r[8] ?? '')) break;
    itens.push({ nome, qtd: moedaBR(r[8]), valor: moedaBR(r[9]), valorFinal: moedaBR(r[10]) });
  }
  return { itens, total };
}

/**
 * Interpreta a matriz da aba "Cópia de <MÊS>" no layout atual:
 * diário em B–F (a coluna A é um contador de dias), totais/ticket/rodapé por
 * rótulo na coluna B e blocos em H–K (nome | qtde | valor | valor final).
 * Se a aba estiver no layout antigo (diário em A–E, blocos em F–H), usa o legado.
 */
export function parseResumoGeral(texto: string[][]): ResumoGeral | null {
  if (!texto || texto.length === 0) return null;

  const idxData = texto.findIndex((r) => (r[1] ?? '').trim().toUpperCase() === 'DATA');
  const idxTicket = texto.findIndex((r) => (r[1] ?? '').trim().toUpperCase().startsWith('TICKET'));
  if (idxData === -1 || idxTicket === -1) return parseResumoLegado(texto);

  const diario: LinhaDiaria[] = [];
  let tot: string[] = [];
  for (let i = idxData + 1; i < texto.length; i++) {
    const r = texto[i];
    const data = (r[1] ?? '').trim();
    if (eDataBR(data)) {
      diario.push({
        data,
        qtde: moedaBR(r[2]),
        lancados: moedaBR(r[3]),
        valor: moedaBR(r[4]),
        valorFinal: moedaBR(r[5]),
      });
      continue;
    }
    // Primeira linha sem data e com qtde numérica = linha de totais.
    if (data === '' && eNum((r[2] ?? '').trim())) {
      tot = r;
      break;
    }
  }
  if (diario.length < 3 || tot.length === 0) return parseResumoLegado(texto);

  const tick = texto[idxTicket] ?? [];
  const num = (r: string[] | undefined, c: number): number => moedaBR(r?.[c]);

  const linhaDe = (rotulo: string): string[] | undefined =>
    texto.find((r) => (r[1] ?? '').trim().toUpperCase() === rotulo);
  const canc = linhaDe('CANCELADO');
  const bon = linhaDe('BONIFICAÇÃO');
  const exp = linhaDe('EXPOSITOR');
  const aga = texto.find((r) => (r[7] ?? '').trim().toUpperCase().startsWith('AGUARDANDO'));

  return {
    diario,
    totalQtde: num(tot, 2),
    totalLancados: num(tot, 3),
    totalValor: num(tot, 4),
    totalFinal: num(tot, 5),
    ticketValor: num(tick, 4),
    ticketFinal: num(tick, 5),
    cancelQtd: num(canc, 4),
    cancelValor: num(canc, 5),
    bonifQtd: num(bon, 4),
    bonifValor: num(bon, 5),
    exposQtd: num(exp, 4),
    exposValor: num(exp, 5),
    aguardQtd: aga ? moedaBR(aga[8]) : 0,
    aguardValor: aga ? moedaBR(aga[9]) || moedaBR(aga[10]) : 0,
    gestores: parseBloco(texto, 'GERENTE').itens,
    clientes: parseBloco(texto, 'CLIENTES').itens,
    empresas: parseBloco(texto, 'EMPRESA').itens,
  };
}

/* ------------------------- Base de clientes (ano) ------------------------- */

export interface ClienteAno {
  chave: string;
  nome: string;
  cnpj: string;
  uf: string;
  rpi: string;
  pedidos: number;
  receita: number;
  primeiraCompra: string; // ISO aaaa-mm-dd ou ''
  ultimaCompra: string; // ISO aaaa-mm-dd ou ''
  /** Valor e vendedor (RPI) da última compra — base da coluna Reativação. */
  ultimaCompraValor: number;
  ultimaCompraVendedor: string;
  diasSemComprar: number | null;
  meses: string[];
  /** Tem linhas mas nenhuma compra válida — só cancelados/marcadores. */
  soCancelados: boolean;
}

/**
 * Base de clientes do ano inteiro: agrupa por CNPJ/nome somando todos os meses.
 * Recência = dias desde a última Data Lançamento válida (null = sem data).
 */
export function resumirClientesAno(vendas: Venda[], hoje: Date = new Date()): ClienteAno[] {
  const mapa = new Map<string, ClienteAno & { mesesSet: Set<string>; marc: boolean }>();
  for (const v of vendas) {
    // Marcadores não formam cliente/venda (mesma regra das outras telas).
    if (!ehLinhaValida(v) || marcador(v) !== null) continue;
    const nome = campo(v, 'Cliente') || '(sem nome)';
    const cnpj = campo(v, 'CNPJ');
    const dig = cnpj.replace(/\D/g, '');
    const chave = dig ? `cnpj:${dig}` : `nome:${nome.toLowerCase()}`;
    let c = mapa.get(chave);
    if (!c) {
      c = {
        chave, nome, cnpj,
        uf: campo(v, 'UF'),
        rpi: campo(v, 'RPI'),
        pedidos: 0, receita: 0,
        primeiraCompra: '', ultimaCompra: '', ultimaCompraValor: 0, ultimaCompraVendedor: '',
        diasSemComprar: null,
        meses: [], mesesSet: new Set<string>(),
        soCancelados: false, marc: false,
      };
      mapa.set(chave, c);
    }
    if (marcador(v) !== null) c.marc = true;
    if (ehContabil(v)) {
      c.pedidos += 1;
      c.receita += valorLiquido(v);
      const raw = dataLancamentoValida(v);
      if (raw) {
        const iso = new Date(raw).toISOString().slice(0, 10);
        if (!c.primeiraCompra || iso < c.primeiraCompra) c.primeiraCompra = iso;
        if (!c.ultimaCompra || iso > c.ultimaCompra) {
          c.ultimaCompra = iso;
          c.ultimaCompraValor = valorLiquido(v);
          c.ultimaCompraVendedor = campo(v, 'RPI');
        }
      }
    }
    if (!c.uf) c.uf = campo(v, 'UF');
    if (!c.rpi) c.rpi = campo(v, 'RPI');
    if (v._mes) c.mesesSet.add(v._mes);
  }
  const diaMs = 24 * 60 * 60 * 1000;
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return [...mapa.values()].map(({ mesesSet, marc, ...c }) => {
    let dias: number | null = null;
    if (c.ultimaCompra) {
      const [a, m, d] = c.ultimaCompra.split('-').map(Number);
      dias = Math.max(0, Math.round((inicioHoje - new Date(a, m - 1, d).getTime()) / diaMs));
    }
    return { ...c, diasSemComprar: dias, meses: [...mesesSet], soCancelados: c.pedidos === 0 && marc };
  });
}

/* --------------------- Reativação (Oportunidades) --------------------- */

export interface OportunidadeReativacao {
  id: string;
  nome: string;
  cnpj: string;
  /** RPI da última compra. */
  vendedor: string;
  valorUltima: number;
  ultimaCompra: string;
  diasSemComprar: number;
}

/**
 * Clientes sem compra há `limiteDias` (60) ou mais, derivados das abas por
 * CNPJ/nome. O card leva nome, CNPJ, último vendedor e valor da última compra.
 */
export function derivarReativacao(vendas: Venda[], hoje: Date = new Date(), limiteDias = 60): OportunidadeReativacao[] {
  return resumirClientesAno(vendas, hoje)
    .filter((c): c is ClienteAno & { diasSemComprar: number } =>
      c.diasSemComprar !== null && c.diasSemComprar >= limiteDias,
    )
    .map((c) => ({
      id: c.chave,
      nome: c.nome,
      cnpj: c.cnpj,
      vendedor: c.ultimaCompraVendedor,
      valorUltima: c.ultimaCompraValor,
      ultimaCompra: c.ultimaCompra,
      diasSemComprar: c.diasSemComprar,
    }))
    .sort((a, b) => b.valorUltima - a.valorUltima);
}

/** Top receita por extrator: só lançamentos contábeis (Nº Ped. + valor numérico). */
export function topPor(vendas: Venda[], chave: (v: Venda) => string, top = 10): { nome: string; receita: number; pedidos: number }[] {
  const mapa = new Map<string, { receita: number; pedidos: number }>();
  for (const v of vendas) {
    if (!ehContabil(v)) continue;
    const k = chave(v) || '(não informado)';
    const e = mapa.get(k) ?? { receita: 0, pedidos: 0 };
    e.receita += valorLiquido(v);
    e.pedidos += 1;
    mapa.set(k, e);
  }
  return [...mapa.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, top);
}

/** Série diária de Valor Líquido: só lançamentos contábeis com data válida. */
export function serieDiaria(vendas: Venda[], dias = 60): { data: string; receita: number; pedidos: number }[] {
  const mapa = new Map<string, { receita: number; pedidos: number }>();
  for (const v of vendas) {
    if (!ehContabil(v)) continue;
    const raw = dataLancamentoValida(v);
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    const e = mapa.get(key) ?? { receita: 0, pedidos: 0 };
    e.receita += valorLiquido(v);
    e.pedidos += 1;
    mapa.set(key, e);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-dias)
    .map(([data, v]) => ({ data, ...v }));
}
