/** Utilidades de formatação pt-BR. */

export function moeda(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function numero(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR');
}

export function dataCurta(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('pt-BR');
}

export function texto(valor: unknown, vazio = '—'): string {
  if (valor === null || valor === undefined) return vazio;
  const s = String(valor).trim();
  return s === '' ? vazio : s;
}

export function numeroOuZero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza texto para cruzamento de nomes (sem acento, maiúsculas, espaços simples). */
export function normalizarNome(valor: unknown): string {
  const t = valor === null || valor === undefined ? '' : String(valor).trim();
  if (t === '') return '';
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ');
}

/** Converte a data da planilha (dd/mm/aaaa ou ISO com hora) em aaaa-mm-dd local. '' se inválida. */
export function dataISO(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const s = String(valor).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}
