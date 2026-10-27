/**
 * Definição das metas exibidas na aba META.
 * Valores passados pelo gestor (dia 26/10/2026) — nenhum número é inventado aqui.
 * Edite este arquivo todo período: as metas mudam de valor e de janela.
 */
export interface MetaDef {
  /** Nome exibido no app. */
  responsavel: string;
  /** Valor da meta em R$. */
  valor: number;
  /**
   * 'equipe' = soma dos RPIs cujo RESPONSAVEL é este nome na aba Equipe;
   * 'proprio' = vendas do próprio (ele é representante, não gestor).
   */
  tipo: 'equipe' | 'proprio';
  /** Para tipo 'proprio': nome do RPI nas abas de venda. */
  rpi?: string;
  /** Para tipo 'proprio': COD. VENDEDOR do RPI (cruzamento exato). */
  codigo?: string;
}

export const META_DEFS: MetaDef[] = [
  { responsavel: 'Josimar', valor: 300000, tipo: 'equipe' },
  { responsavel: 'Cristiano', valor: 165000, tipo: 'equipe' },
  { responsavel: 'Thalles', valor: 20000, tipo: 'proprio', rpi: 'THALLES AFONSO', codigo: '1313' },
];
