# Grupo Festa ADM

Aplicativo **Electron + React + TypeScript** para gestão comercial do Grupo Festa, disponível como
app desktop (instalador Windows) e como versão web (Netlify). Todos os números vêm **exclusivamente
da planilha mestre** via Google Apps Script — nenhum dado fictício ou mock.

## Páginas

| Rota | Página | O que mostra |
|---|---|---|
| `/` | Dashboard | Receita, pedidos, ticket, série diária, UF, RPI e comparativos do mês |
| `/dashboard-clientes` | Dashboard Clientes | Base por CNPJ, novos × base, inativos (>90 dias), UF e RPI |
| `/clientes` | Clientes | Cadastro derivado das vendas, com filtros e recência |
| `/vendas` | Vendas | Todas as linhas das abas mensais (tabela crua + filtros + total) |
| `/meta` | Meta | Metas por responsável: previsto × realizado na janela 26 → fim do mês |
| `/fechamento-2025` | Fechamento 2025 | Relatório mensal (jan → dez) da planilha pública "Acompanhamento de RPIs 2025" |
| `/oportunidades` | Oportunidades | Kanban de clientes/reativação (grava C/N na planilha) |
| `/atividades` | Atividades | Um pedido = uma atividade, com filtro por data |
| `/equipe` | Equipe | Cadastro da aba Equipe (nomes, UF e responsável) com pedidos/receita por código |
| `/config` | Configurações | Token de escrita da API |

## Fonte de dados

- API (Apps Script): `https://script.google.com/macros/s/AKfycbyYOiiySDA56ab3fOlc48wRps9RtPFKAucA6MwjejPp2gSSg4yeknhT-O9eujJdfzCAeA/exec`
- `action=abas` → lista as abas disponíveis; toda aba com nome de mês (JANEIRO…DEZEMBRO) é carregada
  automaticamente — não há lista fixa de meses no código.
- `action=listar&aba=JANEIRO` → linhas da aba.
- Escrita: POST JSON `action=cadastrar|atualizar|excluir` com `token`. O token é configurado em
  **Configurações** e fica no `localStorage` (`gfadm.apiToken`); a leitura é aberta.
- Fonte do Apps Script: `Codigo-API-MESTRE.gs` (após editar: Implantar → Gerenciar implantações →
  lápis → Nova versão → Implantar — mantém a mesma URL).

### Colunas das abas mensais (14)

`Data E-mail` · `VALOR FORMULÁRIO` · `Data Lançamento` · `Nº Ped.` · `Valor Líquido` ·
`Novos Clientes` · `Cliente` · `CNPJ` · `UF` · `COD. VENDEDOR` · `RPI` · `VELA8` · `PROMO2` · `SAZONAL`

### Fechamento 2025 (segunda planilha, pública)

- **Fonte**: planilha pública
  [Acompanhamento de RPIs 2025](https://docs.google.com/spreadsheets/d/18QGMUUd3aKuqTtEqSF9BQbsRBnmE5wr4VIpS8RihcQw/edit)
  (a mesma que o gestor anexa em XLSX). Lida pelo navegador, sem backend e **sem cópia local** — os
  números mudam na planilha e a aba muda junto.
- **Endpoint**: `export?format=csv&gid=<GID>` (`src/lib/fechamento2025.ts`, constante `ABAS_2025`).
  **Nunca usar `gviz/tq?tqx=out:csv&sheet=NOME`**: o gviz descarta as linhas ocultas por filtro da
  planilha — em NOVEMBRO/DEZEMBRO ele devolvia 51–58 dos 113 RPIs. O `export` devolve a aba inteira
  (validado nas 12 abas: total de linhas igual ao XLSX e `Total Mês` = soma dos períodos em 100% das
  linhas).
- O `gid` de cada aba é o valor da URL ao abri-la (`.../edit#gid=123`). Se uma aba for **recriada** na
  planilha o gid muda — atualize `ABAS_2025`.
- **Estrutura detectada pelo cabeçalho** (varia por mês): 2–3 colunas de `META*`, 2–3 colunas de
  período, `Total Mês`, `% DE ALCANCE DA COTA GERAL`, `COTA PROPORCIONAL`,
  `% DE ALCANCE DA COTA PROPORCIONAL` e colunas extras (`VELA 10`, `PROMO2`, `COMISSÃO`, `PRÊMIO`…).
  DEZEMBRO não tem `SOMA DAS METAS` (meta única).
- **Linha de RPI**: 1ª coluna (equipe `FB`/`SG`) e `VENDEDOR` preenchidos; o bloco de resumo da planilha
  vem depois e não tem equipe — por isso é ignorado. As linhas "avulsas" (ex.: códigos 79/238) ficam
  fora, como na própria planilha.
- **Exibição**: valores de `%` e `COTA` vêm **lidos da planilha** (formato `129,5%`, `10.000,00`);
  só as linhas de total são calculadas (soma) e o alcance geral = `Total Mês ÷ soma das metas`,
  mesma base do "ALCANCE - GERAL" da planilha.

## Regras de negócio

- **Linhas vazias** (sem cliente/CNPJ/pedido/valores) são ignoradas em todos os cálculos.
- **Receita contábil**: entra só a linha com `Nº Ped.` preenchido, `Valor Líquido` numérico e
  **sem marcador**. Marcadores excluídos: `CANCELADO`, `EXPOSITOR`, `BONIFICAÇÃO`, `TROCA`
  (detectados nas 4 primeiras colunas, no Cliente e no Valor Líquido). Texto não numérico no
  `Valor Líquido` também exclui.
- **`VALOR FORMULÁRIO` é bruto (tabela)** — nunca é somado como receita.
- **Fechamento fiscal: dia 26 → dia 25** (o Dashboard exibe a janela lida do relatório).
- **Clientes por CNPJ**: reativação a partir de 60 dias sem comprar; inativos contados acima de 90.
- **Meta** (`/meta`): janela do ciclo fiscal **26 → 25** (antes do dia 26, o ciclo é o do mês
  corrente; a partir do dia 26, o do mês seguinte), avaliada pela **Data E-mail**.
  **Previsto** = `VALOR FORMULÁRIO` (tabela) dos pedidos com Data E-mail na janela, inclusive sem
  Nº Ped./lançamento; **Realizado** = `Valor Líquido` somente com Nº Ped. preenchido;
  cancelado/bonificação/expositor/troca não contam.
  - Josimar e Cristiano: soma das vendas dos RPIs que cada um responde na aba **Equipe**
    (cruzamento exato `Equipe.CODIGO` = `COD. VENDEDOR`), mais os códigos avulsos definidos em
    `src/lib/metas.ts` (correções de responsável e variações de código).
  - Wendel Santana (código 79) e Wendel Santana 2 (código 238) contam para **Josimar**.
  - Thalles: vendas próprias (RPI `THALLES AFONSO`, `COD. VENDEDOR` 1313).
  - Valores e responsáveis editáveis em `src/lib/metas.ts`.
  - **Responsáveis sem meta**: lista configurável em `SEM_META` (`src/lib/metas.ts`), atualmente
    **Junior**, **Atacado** e **Responsável Interno**. Aparecem em painel informativo com RPIs, pedidos, previsto e
    realizado, mas **não entram no cálculo da Meta Geral**. Para incluir novos nomes, basta
    adicioná-los à lista.
  - **Média/Pedido por RPI**: `Realizado ÷ pedidos com Nº Ped. preenchido`, exibida na tabela
    “Por RPI” (somente responsáveis com meta) e ordenável junto com as demais colunas.
  - **Meta Geral**: R$ 1.630.000,00 definida pelo gestor; não é a soma automática das metas
    individuais — as metas individuais são acompanhamentos separados.

## Rodar

```bash
npm install
npm run dev            # renderer em http://localhost:5173
npm run electron:dev   # Electron apontando para o Vite (dev)
```

Pré-requisito: **Node 20+**.

## Build + instalador Windows

```bash
npm run build   # tsc -b + vite build + tsc do Electron → dist/ e dist-electron/
npm run dist    # electron-builder: NSIS + portable em release/
```

Ícone opcional em `build/icon.ico`.

## Publicar a versão web (Netlify)

1. `npm run build`;
2. Arraste **apenas a pasta `dist/`** em https://app.netlify.com/drop
   (o `_redirects` já está incluído para o HashRouter).

Alternativa: conectar o repositório na Netlify — build `npm run build`, publish `dist`.

## Estrutura

```
src/
  pages/         Dashboard, Clientes, Vendas, Meta, Fechamento2025, Oportunidades, Atividades, Equipe, Config
  components/    Layout, UI
  hooks/         useVendas (descoberta dinâmica das abas + carga)
  state/         VendasContext
  lib/           api, domain (regras), config, metas, format, fechamento2025 (planilha 2025)
electron/        processo principal + preload
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Vite (renderer) |
| `npm run electron:dev` | Electron em modo dev |
| `npm run build` | TypeScript + Vite + Electron |
| `npm run dist` | Build + instalador Windows (NSIS + portable) |
| `npm run typecheck` | Só checagem de tipos |
