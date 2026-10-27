# Grupo Festa ADM

Aplicativo desktop (Electron + React + TypeScript) com dados **exclusivos da API da planilha mestre**
(Google Apps Script). Nenhum dado fictício: Dashboard, Clientes, Oportunidades, Atividades e Equipe derivam
das abas mensais (JANEIRO a OUTUBRO).

## Fonte de dados

- Base (mestre): `https://script.google.com/macros/s/AKfycbyYOiiySDA56ab3fOlc48wRps9RtPFKAucA6MwjejPp2gSSg4yeknhT-O9eujJdfzCAeA/exec`
- Leitura: `action=listar&aba=OUTUBRO` (e demais meses). Colunas: Data Lançamento, Nº Ped.,
  Valor Líquido, Novos Clientes (C = base, N = novo), Cliente, CNPJ, UF, COD. VENDEDOR, RPI, VELA8, PROMO2, SAZONAL.
- Escrita: POST JSON `action=cadastrar|atualizar|excluir` na aba do mês corrente (`OUTUBRO`) — exige token.
- Linhas em branco são ignoradas em todos os cálculos. A mestre não marca
  cancelados/bonificação/expositores — todos os lançamentos válidos somam na receita.

### Mapeamento honesto (limitação da planilha atual)

| Área | Origem real |
|---|---|
| Dashboard | Agregações de `Valor Líquido`, `Data Lançamento`, `UF`, `RPI`, `Emp.`, `C/N` |
| Clientes | Agrupamento por `CNPJ`/`Cliente` de VENDAS |
| Oportunidades (Kanban) | Uma linha = um card; etapa = `C/N` (vazio=Prospecção, N=Negociação, C=Ganha). Mover grava `C/N` via `atualizar` |
| Atividades | Um pedido = uma atividade; responsável=`RESP.`/`RPI`, tipo=`Emp.`, status=`C/N`+`Confirmação`, data=`Data Lançamento` |
| Equipe | Pessoas distintas de `RPI` e `RESP.` com receita/pedidos |

> Para ter Clientes/Oportunidades/Atividades como tabelas independentes, crie abas próprias na planilha e
> aponte o app para elas — o cliente `src/lib/api.ts` já é genérico (`listar/cadastrar/atualizar/excluir` por aba).

## Rodar

```bash
npm install
npm run dev          # renderer em http://localhost:5173
npm run electron:dev # abre o Electron apontando para o Vite (dev)
```

## Build + instalador Windows

```bash
npm run build   # valida TS + gera dist/ + dist-electron/
npm run dist    # electron-builder: NSIS + portable em release/
```

Pré-requisitos: Node 20+. Ícone opcional em `build/icon.ico`. Para erro de token na escrita,
configure o token em **Configurações** (salvo em `localStorage`) — ele é enviado como `token` no GET e no POST.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Vite (renderer) |
| `npm run electron:dev` | Electron em modo dev (`tsx electron/main.ts`, usa `VITE_DEV_URL`) |
| `npm run build` | `tsc -b` + `vite build` + `tsc -p tsconfig.node.json` |
| `npm run dist` | build + instalador Windows (NSIS + portable, sem publish) |
