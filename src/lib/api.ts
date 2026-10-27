/**
 * Cliente HTTP da API operacional (Google Apps Script).
 *
 * Ações de leitura (GET): ping, abas, cabecalho, listar, consultar.
 * Ações de escrita (POST JSON): cadastrar, atualizar, excluir.
 * Toda mutação do app passa por aqui — nada é persistido localmente.
 */
import { API_BASE_URL, getApiToken } from './config';

export type Registro = Record<string, unknown> & { _linha: number };

interface ListarResposta {
  ok: boolean;
  aba: string;
  campos: string[];
  total: number;
  limit: number;
  offset: number;
  registros: Registro[];
  erro?: string;
}

function buildUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${API_BASE_URL}?${qs}`;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida da API: ${text.slice(0, 200)}`);
  }
}

function assertOk(payload: unknown): asserts payload is { ok: boolean; erro?: string } & Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || (payload as { ok?: unknown }).ok !== true) {
    const erro =
      typeof payload === 'object' && payload !== null && 'erro' in payload
        ? String((payload as { erro: unknown }).erro)
        : 'Falha desconhecida na API';
    throw new Error(erro);
  }
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const token = getApiToken();
  const res = await fetch(buildUrl(token ? { ...params, token } : params));
  const payload = await parseJson(res);
  assertOk(payload);
  return payload as T;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const token = getApiToken();
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    // text/plain evita o preflight CORS (OPTIONS) que o Apps Script não responde;
    // o corpo continua sendo JSON e o doPost faz JSON.parse do postData.contents.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(token ? { ...body, token } : body),
  });
  const payload = await parseJson(res);
  assertOk(payload);
  return payload as T;
}

export async function ping(): Promise<{ ok: boolean; mensagem: string; abas: string[] }> {
  return get<{ ok: boolean; mensagem: string; abas: string[] }>({ action: 'ping' });
}

export async function listarAbas(): Promise<string[]> {
  const r = await get<{ abas: string[] }>({ action: 'abas' });
  return r.abas;
}

export async function obterCabecalho(aba: string): Promise<string[]> {
  const r = await get<{ campos: string[] }>({ action: 'cabecalho', aba });
  return r.campos;
}

/** Lista até `limit` registros (a API permite máx. 1000 por chamada). */
export async function listar(aba: string, opts: { limit?: number; offset?: number; pesquisa?: string } = {}): Promise<ListarResposta> {
  const params: Record<string, string> = {
    action: 'listar',
    aba,
    limit: String(opts.limit ?? 1000),
    offset: String(opts.offset ?? 0),
  };
  if (opts.pesquisa) params.pesquisa = opts.pesquisa;
  return get<ListarResposta>(params);
}

/** Busca todos os registros com paginação automática e retentativas (a API às vezes estoura o tempo). */
export async function listarTudo(aba: string, pesquisa?: string, tentativas = 3): Promise<{ campos: string[]; registros: Registro[] }> {
  const limit = 500;
  let offset = 0;
  let campos: string[] = [];
  const todos: Registro[] = [];
  for (;;) {
    let pagina: ListarResposta | null = null;
    let ultimoErro: unknown = null;
    for (let t = 0; t < tentativas; t++) {
      try {
        pagina = await listar(aba, { limit, offset, pesquisa });
        break;
      } catch (e) {
        ultimoErro = e;
      }
    }
    if (!pagina) throw ultimoErro instanceof Error ? ultimoErro : new Error(`Falha ao ler a aba ${aba}`);
    campos = pagina.campos;
    todos.push(...pagina.registros);
    if (pagina.registros.length < limit || todos.length >= pagina.total) break;
    offset += limit;
  }
  return { campos, registros: todos };
}

export async function consultarPorLinha(aba: string, linha: number): Promise<Registro> {
  const r = await get<{ registro: Registro }>({ action: 'consultar', aba, linha: String(linha) });
  return r.registro;
}

export interface MatrizResposta {
  ok: boolean;
  aba: string;
  linhas: number;
  colunas: number;
  texto: string[][];
  valores: unknown[][];
}

/** Lê a matriz crua da aba (para relatórios visuais como o RESUMO DIÁRIO). */
export async function matriz(aba: string, maxLin = 60, maxCol = 20): Promise<MatrizResposta> {
  return get<MatrizResposta>({ action: 'matriz', aba, maxLin: String(maxLin), maxCol: String(maxCol) });
}

/** Insere uma linha nova na aba. `registro` usa os nomes exatos do cabeçalho. */
export async function cadastrar(aba: string, registro: Record<string, unknown>): Promise<Registro> {
  const r = await post<{ registro: Registro }>({ action: 'cadastrar', aba, registro });
  return r.registro;
}

/** Atualiza a linha indicada. Somente colunas enviadas são sobrescritas. */
export async function atualizarPorLinha(aba: string, linha: number, registro: Record<string, unknown>): Promise<Registro> {
  const r = await post<{ registro: Registro }>({ action: 'atualizar', aba, linha, registro });
  return r.registro;
}

/** Exclui a linha física indicada. */
export async function excluirPorLinha(aba: string, linha: number): Promise<void> {
  await post<{ ok: boolean }>({ action: 'excluir', aba, linha });
}
