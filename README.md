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

## Regras de negócio

- **Linhas vazias** (sem cliente/CNPJ/pedido/valores) são ignoradas em todos os cálculos.
- **Receita contábil**: entra só a linha com `Nº Ped.` preenchido, `Valor Líquido` numérico e
  **sem marcador**. Marcadores excluídos: `CANCELADO`, `EXPOSITOR`, `BONIFICAÇÃO`, `TROCA`
  (detectados nas 4 primeiras colunas, no Cliente e no Valor Líquido). Texto não numérico no
  `Valor Líquido` também exclui.
- **`VALOR FORMULÁRIO` é bruto (tabela)** — nunca é somado como receita.
- **Fechamento fiscal: dia 26 → dia 25** (o Dashboard exibe a janela lida do relatório).
- **Clientes por CNPJ**: reativação a partir de 60 dias sem comprar; inativos contados acima de 90.
- **Meta** (`/meta`): janela do dia 26 até o último dia do mês corrente, avaliada pela **Data E-mail**.
  **Previsto** = `VALOR FORMULÁRIO` (tabela) dos pedidos com Data E-mail na janela, inclusive sem
  Nº Ped./lançamento; **Realizado** = `Valor Líquido` somente com Nº Ped. preenchido;
  cancelado/bonificação/expositor/troca não contam.
  - Josimar e Cristiano: soma das vendas dos RPIs que cada um responde na aba **Equipe**
    (cruzamento exato `Equipe.CODIGO` = `COD. VENDEDOR`), mais os códigos avulsos definidos em
    `src/lib/metas.ts` (correções de responsável e variações de código).
  - Thalles: vendas próprias (RPI `THALLES AFONSO`, `COD. VENDEDOR` 1313).
  - Valores e responsáveis editáveis em `src/lib/metas.ts`.

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
  pages/         Dashboard, Clientes, Vendas, Meta, Oportunidades, Atividades, Equipe, Config
  components/    Layout, UI
  hooks/         useVendas (descoberta dinâmica das abas + carga)
  state/         VendasContext
  lib/           api, domain (regras), config, metas, format
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
