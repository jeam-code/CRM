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
  /** Nome exibido na tabela Por RPI para um código específico (sobrepõe o nome da Equipe). */
  nomesExtra?: Record<string, string>;
}

export const META_DEFS: MetaDef[] = [
  {
    responsavel: 'Josimar',
    valor: 300000,
    tipo: 'equipe',
    // Wendel Santana (79) e Wendel Santana 2 (238) são ambos de Josimar,
    // independentemente do cadastro que estiver momentaneamente na aba Equipe.
    codigosExtra: ['24', '5085', '79', '238'],
    nomesExtra: {
      '24': 'WAGNER LINS REGIAO SUL',
      '5085': 'WAGNER LINS - COLIBRI/COLMEIA',
      '79': 'WENDEL SANTANA',
      '238': 'WENDEL SANTANA 2',
    },
  },
  {
    responsavel: 'Cristiano',
    valor: 165000,
    tipo: 'equipe',
    // 990 já consta sob Cristiano na aba Equipe; resta o 8129, que ainda não está lá.
    codigosExtra: ['8129'],
    nomesExtra: { '8129': 'THIAGO TROPEIA' },
  },
  { responsavel: 'Thalles', valor: 20000, tipo: 'proprio', rpi: 'THALLES AFONSO', codigo: '1313' },
];

/**
 * Responsáveis acompanhados sem meta definida neste primeiro momento.
 * Aparecem no painel informativo da aba Meta, fora do cálculo da Meta Geral.
 * Para incluir novos nomes, basta adicioná-los nesta lista.
 */
export const SEM_META: string[] = ['Junior', 'Atacado', 'Interno'];

/**
 * Meta geral do mês (grupo), definida pelo gestor.
 * Não é a soma automática das metas individuais — é o objetivo do grupo.
 */
export const META_GERAL = 1_630_000;
