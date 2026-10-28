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
  /**
   * Códigos que pertencem a este responsável além dos listados na aba Equipe
   * (variações de código do mesmo vendedor ou correção de responsável).
   */
  codigosExtra?: string[];
  /** Nome exibido para códigos que não existem na aba Equipe. */
  nomesExtra?: Record<string, string>;
}

export const META_DEFS: MetaDef[] = [
  {
    responsavel: 'Josimar',
    valor: 300000,
    tipo: 'equipe',
    codigosExtra: ['24', '5085', '47', '1201'],
    nomesExtra: { '24': 'WAGNER LINS REGIAO SUL', '5085': 'WAGNER LINS - COLIBRI/COLMEIA' },
  },
  {
    responsavel: 'Cristiano',
    valor: 165000,
    tipo: 'equipe',
    codigosExtra: ['8129', '990', '9988'],
    nomesExtra: { '8129': 'THIAGO TROPEIA' },
  },
  { responsavel: 'Thalles', valor: 20000, tipo: 'proprio', rpi: 'THALLES AFONSO', codigo: '1313' },
];
