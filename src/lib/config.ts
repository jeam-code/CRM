/**
 * Configuração central do app.
 * Fonte única de dados: planilha MESTRE (uma aba por mês).
 * Nenhum dado fictício é usado.
 */
import { normalizarNome } from './format';

export const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbyYOiiySDA56ab3fOlc48wRps9RtPFKAucA6MwjejPp2gSSg4yeknhT-O9eujJdfzCAeA/exec';

/** Abas mensais da planilha mestre. */
export const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
] as const;

export type Mes = (typeof MESES)[number];

/** Nomes de mês válidos — abas novas como NOVEMBRO/DEZEMBRO são reconhecidas automaticamente. */
export const NOMES_MESES_ANO = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const;

/** Diz se o nome corresponde a uma aba mensal (ignora acentos e caixa). */
export function eNomeDeMes(nome: string): boolean {
  const t = normalizarNome(nome);
  return (NOMES_MESES_ANO as readonly string[]).some((m) => normalizarNome(m) === t);
}

/** Aba usada para cadastros/edições feitas no app (mês corrente). */
export const ABA_ESCRITA: Mes = 'OUTUBRO';

const TOKEN_KEY = 'gfadm.apiToken';

export function getApiToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setApiToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    /* armazenamento indisponível */
  }
}
