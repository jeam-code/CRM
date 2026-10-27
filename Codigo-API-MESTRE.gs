/**
 * API - Planilha MESTRE Grupo Festa (um aba por mês)
 *
 * Abas suportadas (nomes exatos):
 * JANEIRO, FEVEREIRO, MARÇO, ABRIL, MAIO, JUNHO,
 * JULHO, AGOSTO, SETEMBRO, OUTUBRO
 * Cópia de JANEIRO ... Cópia de OUTUBRO (resumos visuais mensais)
 *
 * Colunas de cada aba mensal (linha 1 = nomes dos campos):
 * Data Lançamento | Nº Ped. | Valor Líquido | Novos Clientes |
 * Cliente | CNPJ | UF | COD. VENDEDOR | RPI | VELA8 | PROMO2 | SAZONAL
 *
 * Premissa: o código NÃO altera estrutura, só lê o cabeçalho
 * e lê/adiciona/atualiza linhas de dados.
 *
 * COMO INSTALAR:
 * 1. Abra a planilha mestre > Extensões > Apps Script
 * 2. Apague o Code.gs padrão e cole este arquivo inteiro
 * 3. Salve (Ctrl+S), selecione doGet > Executar (autorize com sua conta)
 * 4. Implantar > Nova implantação > tipo "App da Web":
 *    - Executar como: Eu (seu e-mail)
 *    - Quem tem acesso: Qualquer pessoa
 * 5. Copie a URL que termina com /exec
 * 6. Mudou o código depois? Implantar > Gerenciar implantações
 *    > lápis > Versão: "Nova versão" > Implantar.
 */

// ============ CONFIGURAÇÃO ============

// Nomes exatos das abas (case-sensitive). Mantenha igual ao da planilha.
const ABAS_PERMITIDAS = [
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
  'Equipe', // aba de cadastro das equipes (códigos de vendedor por responsável)
  'Cópia de JANEIRO',
  'Cópia de FEVEREIRO',
  'Cópia de MARÇO',
  'Cópia de ABRIL',
  'Cópia de MAIO',
  'Cópia de JUNHO',
  'Cópia de JULHO',
  'Cópia de AGOSTO',
  'Cópia de SETEMBRO',
  'Cópia de OUTUBRO',
  'Cópia de NOVEMBRO',
  'Cópia de DEZEMBRO'
];

// Token simples para proteger escrita. Troque por uma senha forte.
// Uso: ?token=SEU_TOKEN nas requisições.
// Se deixar '' (vazio), a API fica aberta — NÃO recomendado.
const API_TOKEN = 'TROQUE_POR_UM_TOKEN_FORTE';

// Leitura exige token? true = até GET precisa de token. false = leitura aberta, escrita com token.
const EXIGIR_TOKEN_NA_LEITURA = false;

// Nome do campo considerado ID único (procura case-insensitive).
// Nº Ped. entra como candidato para permitir consultar por pedido (?id=2449).
const CAMPOS_ID_CANDIDATOS = ['id', 'ID', 'Id', 'codigo', 'código', 'cod', 'nº ped.', 'nº ped', 'pedido', 'ped'];

// ============ ENTRADAS HTTP ============

function doGet(e) {
  e = e || {};
  const p = (e.parameter) || {};
  try {
    if (EXIGIR_TOKEN_NA_LEITURA) validarToken(p);

    const action = String(p.action || 'listar').toLowerCase().trim();

    if (action === 'ping' || action === 'status') {
      return json({ ok: true, mensagem: 'API mestre online', datahora: new Date().toISOString(), abas: ABAS_PERMITIDAS });
    }

    if (action === 'abas' || action === 'listarabas') {
      return json({ ok: true, abas: listarAbasReais_() });
    }

    if (action === 'cabecalho' || action === 'campos' || action === 'schema') {
      const aba = exigirAba_(p);
      return json({ ok: true, aba: aba, campos: getCabecalho_(aba) });
    }

    if (action === 'listar') {
      const aba = exigirAba_(p);
      const limit = p.limit ? parseInt(p.limit, 10) : 100;
      const offset = p.offset ? parseInt(p.offset, 10) : 0;
      // Filtros opcionais: ?campo=NOME&valor=X  ou  ?pesquisa=texto  ou  ?where={"RPI":"NOME"}
      return json(listar_(aba, { limit, offset, campo: p.campo, valor: p.valor, pesquisa: p.pesquisa, where: p.where }));
    }

    if (action === 'consultar' || action === 'buscar' || action === 'get') {
      const aba = exigirAba_(p);
      return json(consultar_(aba, p));
    }

    if (action === 'matriz') {
      const aba = exigirAba_(p);
      return json(matriz_(aba, p));
    }

    return json({ ok: false, erro: 'Action inválida. Use: ping, abas, cabecalho, listar, consultar, matriz. Para escrita use POST com action=cadastrar|atualizar|excluir.' }, 400);
  } catch (err) {
    return json({ ok: false, erro: String(err && err.message ? err.message : err) }, 400);
  }
}

function doPost(e) {
  e = e || {};
  let params = Object.assign({}, e.parameter || {});
  let body = {};

  try {
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (ign) {
        body = {};
      }
    }
  } catch (ign) { body = {}; }

  const p = Object.assign({}, params, body);

  try {
    validarToken(p); // escrita SEMPRE exige token (se API_TOKEN configurado)

    const action = String(p.action || '').toLowerCase().trim();

    if (action === 'cadastrar' || action === 'criar' || action === 'inserir' || action === 'create') {
      const aba = exigirAba_(p);
      const registro = p.registro || p.dados || p.data || extrairRegistro_(p);
      return json(cadastrar_(aba, registro));
    }

    if (action === 'atualizar' || action === 'editar' || action === 'update') {
      const aba = exigirAba_(p);
      const registro = p.registro || p.dados || p.data || extrairRegistro_(p);
      return json(atualizar_(aba, p, registro));
    }

    if (action === 'excluir' || action === 'deletar' || action === 'delete' || action === 'apagar') {
      const aba = exigirAba_(p);
      return json(excluir_(aba, p));
    }

    return json({ ok: false, erro: 'Action de POST inválida. Use: cadastrar, atualizar, excluir.' }, 400);
  } catch (err) {
    return json({ ok: false, erro: String(err && err.message ? err.message : err) }, 400);
  }
}

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

// ============ OPERAÇÕES ============

/** Lista registros com paginação e filtros. Não altera a planilha. */
function listar_(nomeAba, opts) {
  opts = opts || {};
  const sh = getAba_(nomeAba);
  const headers = getCabecalho_(nomeAba);
  const lastRow = sh.getLastRow();
  const lastCol = headers.length;

  if (lastRow < 2) return { ok: true, aba: nomeAba, campos: headers, total: 0, registros: [] };

  const limit = Math.min(Math.max(parseInt(opts.limit || 100, 10) || 100, 1), 1000);
  const offset = Math.max(parseInt(opts.offset || 0, 10) || 0, 0);

  const valores = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let lista = valores.map((linha, i) => rowToObj_(headers, linha, i + 2));

  if (opts.where) {
    let w = opts.where;
    if (typeof w === 'string') { try { w = JSON.parse(w); } catch (e) { throw new Error('Parâmetro where inválido. Envie um JSON. Ex: {"RPI":"NOME"}'); } }
    lista = lista.filter(r => Object.keys(w).every(k => {
      const col = acharColuna_(headers, k);
      if (!col) return false;
      return String(r[col] == null ? '' : r[col]).toLowerCase() === String(w[k]).toLowerCase();
    }));
  }

  if (opts.campo && opts.valor !== undefined) {
    const col = acharColuna_(headers, opts.campo);
    if (!col) throw new Error('Campo "' + opts.campo + '" não existe na aba ' + nomeAba + '. Campos: ' + headers.join(', '));
    const v = String(opts.valor).toLowerCase();
    lista = lista.filter(r => String(r[col] == null ? '' : r[col]).toLowerCase() === v);
  }

  if (opts.pesquisa) {
    const q = String(opts.pesquisa).toLowerCase();
    lista = lista.filter(r => headers.some(h => String(r[h] == null ? '' : r[h]).toLowerCase().indexOf(q) !== -1));
  }

  const total = lista.length;
  const pagina = lista.slice(offset, offset + limit);

  return { ok: true, aba: nomeAba, campos: headers, total: total, limit: limit, offset: offset, registros: pagina };
}

/** Consulta um registro por id (ex.: Nº Ped.) ou por linha (?linha=5). */
function consultar_(nomeAba, p) {
  const headers = getCabecalho_(nomeAba);
  const sh = getAba_(nomeAba);

  if (p.linha) {
    const n = parseInt(p.linha, 10);
    if (!n || n < 2 || n > sh.getLastRow()) throw new Error('Linha inválida. Use linha >= 2.');
    const vals = sh.getRange(n, 1, 1, headers.length).getValues()[0];
    return { ok: true, aba: nomeAba, registro: rowToObj_(headers, vals, n) };
  }

  if (p.id === undefined || p.id === null || p.id === '') {
    throw new Error('Informe ?id=VALOR ou ?linha=NUMERO. Ex: ?aba=OUTUBRO&id=2449 (busca pelo Nº Ped.). Opcional: ?idCampo=NOME_DA_COLUNA.');
  }

  const encontrado = acharPorId_(nomeAba, headers, p.id, p.idCampo);
  if (!encontrado) throw new Error('Registro não encontrado na aba ' + nomeAba + ' para id=' + p.id);
  return { ok: true, aba: nomeAba, registro: encontrado.obj };
}

/**
 * Retorna os valores crus da aba em formato de matriz (linhas × colunas).
 * Útil para abas de relatório visual sem cabeçalho padrão na linha 1.
 * Não altera a planilha.
 *
 * Parâmetros opcionais: ?maxLin=60 (máx. 500) e ?maxCol=20 (máx. 50).
 */
function matriz_(nomeAba, p) {
  const sh = getAba_(nomeAba);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) throw new Error('Aba ' + nomeAba + ' está vazia.');

  const maxLin = Math.min(Math.max(parseInt(p.maxLin || '60', 10) || 60, 1), 500);
  const maxCol = Math.min(Math.max(parseInt(p.maxCol || '20', 10) || 20, 1), 50);
  const nLin = Math.min(lastRow, maxLin);
  const nCol = Math.min(lastCol, maxCol);

  const faixa = sh.getRange(1, 1, nLin, nCol);
  return {
    ok: true,
    aba: nomeAba,
    linhas: nLin,
    colunas: nCol,
    texto: faixa.getDisplayValues(),
    valores: faixa.getValues()
  };
}

/** Cadastra uma linha nova. Só anexa no final — nunca reordena nem apaga nada. */
function cadastrar_(nomeAba, registro) {
  if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
    throw new Error('Envie o registro como objeto. Ex: {"action":"cadastrar","aba":"OUTUBRO","registro":{"Cliente":"Maria","Valor Líquido":100}}');
  }
  const headers = getCabecalho_(nomeAba);
  const sh = getAba_(nomeAba);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const novaLinha = headers.map(h => {
      const k = acharChave_(registro, h);
      let v = k ? registro[k] : '';
      if (v === undefined || v === null) v = '';
      return v;
    });
    sh.appendRow(novaLinha);
    const linhaNum = sh.getLastRow();
    const vals = sh.getRange(linhaNum, 1, 1, headers.length).getValues()[0];
    return { ok: true, aba: nomeAba, linha: linhaNum, registro: rowToObj_(headers, vals, linhaNum) };
  } finally {
    lock.releaseLock();
  }
}

/** Atualiza uma linha existente (por id ou por linha). Só sobrescreve colunas enviadas. */
function atualizar_(nomeAba, p, registro) {
  if (!registro || typeof registro !== 'object' || Array.isArray(registro)) throw new Error('Envie "registro" com os campos a atualizar.');
  const headers = getCabecalho_(nomeAba);
  const sh = getAba_(nomeAba);

  let linhaNum = null;
  if (p.linha) {
    linhaNum = parseInt(p.linha, 10);
    if (!linhaNum || linhaNum < 2 || linhaNum > sh.getLastRow()) throw new Error('Linha inválida.');
  } else {
    if (p.id === undefined || p.id === null || p.id === '') throw new Error('Informe id ou linha para atualizar.');
    const enc = acharPorId_(nomeAba, headers, p.id, p.idCampo);
    if (!enc) throw new Error('Registro não encontrado para id=' + p.id);
    linhaNum = enc.linha;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const atuais = sh.getRange(linhaNum, 1, 1, headers.length).getValues()[0];
    const novos = headers.map((h, i) => {
      const k = acharChave_(registro, h);
      if (k && registro[k] !== undefined) return registro[k];
      return atuais[i];
    });
    sh.getRange(linhaNum, 1, 1, headers.length).setValues([novos]);
    return { ok: true, aba: nomeAba, linha: linhaNum, registro: rowToObj_(headers, novos, linhaNum) };
  } finally {
    lock.releaseLock();
  }
}

/** Exclui uma linha (por id ou por linha). Cuidado: isso apaga a linha física. */
function excluir_(nomeAba, p) {
  const headers = getCabecalho_(nomeAba);
  const sh = getAba_(nomeAba);

  let linhaNum = null;
  if (p.linha) {
    linhaNum = parseInt(p.linha, 10);
    if (!linhaNum || linhaNum < 2 || linhaNum > sh.getLastRow()) throw new Error('Linha inválida.');
  } else {
    if (p.id === undefined || p.id === null || p.id === '') throw new Error('Informe id ou linha para excluir.');
    const enc = acharPorId_(nomeAba, headers, p.id, p.idCampo);
    if (!enc) throw new Error('Registro não encontrado para id=' + p.id);
    linhaNum = enc.linha;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    sh.deleteRow(linhaNum);
    return { ok: true, aba: nomeAba, linhaExcluida: linhaNum };
  } finally {
    lock.releaseLock();
  }
}

// ============ HELPERS ============

function exigirAba_(p) {
  const aba = p.aba || p.sheet || p.tab;
  if (!aba) throw new Error('Informe a aba (mês). Ex: ?action=listar&aba=OUTUBRO. Abas: ' + ABAS_PERMITIDAS.join(', '));
  return String(aba);
}

function getAba_(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ABAS_PERMITIDAS.indexOf(nome) === -1) {
    throw new Error('Aba "' + nome + '" não permitida. Permitidas: ' + ABAS_PERMITIDAS.join(', '));
  }
  const sh = ss.getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada na planilha. Verifique o nome exato (acentos e espaços).');
  return sh;
}

function getCabecalho_(nome) {
  const sh = getAba_(nome);
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('Aba ' + nome + ' está vazia.');
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  if (headers.every(h => !h)) throw new Error('Cabeçalho da aba ' + nome + ' está vazio na linha 1.');
  return headers;
}

function listarAbasReais_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().map(s => s.getName());
}

function rowToObj_(headers, rowVals, linhaNum) {
  const o = { _linha: linhaNum };
  headers.forEach((h, i) => { o[h] = rowVals[i]; });
  return o;
}

/** Acha a chave do objeto registro ignorando maiúsculas/acentos/espaços. */
function acharChave_(obj, headerName) {
  const norm = norm_(headerName);
  for (const k in obj) {
    if (k === '_linha' || k === 'action' || k === 'aba' || k === 'sheet' || k === 'tab' || k === 'token' || k === 'id' || k === 'idCampo' || k === 'linha') continue;
    if (norm_(k) === norm) return k;
  }
  return Object.prototype.hasOwnProperty.call(obj, headerName) ? headerName : null;
}

function acharColuna_(headers, nomeCampo) {
  const n = norm_(nomeCampo);
  for (const h of headers) if (norm_(h) === n) return h;
  return null;
}

function norm_(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function acharColunaId_(headers, idCampoSugerido) {
  if (idCampoSugerido) {
    const c = acharColuna_(headers, idCampoSugerido);
    if (!c) throw new Error('Coluna idCampo "' + idCampoSugerido + '" não existe. Campos: ' + headers.join(', '));
    return c;
  }
  for (const cand of CAMPOS_ID_CANDIDATOS) {
    const c = acharColuna_(headers, cand);
    if (c) return c;
  }
  return null;
}

function acharPorId_(nomeAba, headers, id, idCampo) {
  const sh = getAba_(nomeAba);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const colId = acharColunaId_(headers, idCampo);
  const vals = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const alvo = String(id).toLowerCase();
  for (let i = 0; i < vals.length; i++) {
    let match;
    if (colId) {
      const idx = headers.indexOf(colId);
      match = String(vals[i][idx] == null ? '' : vals[i][idx]).toLowerCase() === alvo;
    } else {
      match = false;
    }
    if (match) {
      const linhaNum = i + 2;
      return { linha: linhaNum, obj: rowToObj_(headers, vals[i], linhaNum) };
    }
  }
  return null;
}

/** Separa campos do registro de parâmetros de controle. */
function extrairRegistro_(p) {
  const ignorar = { action: 1, aba: 1, sheet: 1, tab: 1, token: 1, id: 1, idcampo: 1, linha: 1 };
  const reg = {};
  for (const k in p) {
    if (ignorar[String(k).toLowerCase()]) continue;
    reg[k] = p[k];
  }
  return reg;
}

function validarToken(p) {
  if (!API_TOKEN) return;
  const t = p.token || p.key || '';
  if (String(t) !== API_TOKEN) throw new Error('Não autorizado: token inválido ou ausente. Envie ?token=SEU_TOKEN.');
}

function json(obj, status) {
  if (status && !obj.httpStatus) obj.httpStatus = status;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*
 * ============================================================
 * PASSO-A-PASSO PARA PUBLICAR COMO WEB APP (leia com atenção)
 * ============================================================
 *
 * 1) COLE O CÓDIGO
 *    Planilha mestre > Extensões > Apps Script > apague tudo e cole este arquivo > Salve.
 *    Troque API_TOKEN por uma senha forte.
 *
 * 2) TESTE ANTES DE PUBLICAR
 *    No Apps Script, selecione a função doGet > Executar.
 *    Autorize com sua conta Google quando pedir.
 *
 * 3) IMPLANTAR (Deploy)
 *    No Apps Script, clique em "Implantar" (canto superior direito)
 *    > "Nova implantação" > tipo: "App da Web" (Web App).
 *    - Descrição: "API Mestre v1"
 *    - Executar como: "Eu" (seu e-mail)
 *    - Quem tem acesso: "Qualquer pessoa" (necessário p/ app externo sem login Google)
 *    Clique em "Implantar" > autorize > copie a URL que termina com /exec
 *
 * 4) ATUALIZAR O CÓDIGO DEPOIS
 *    Sempre que editar o código: Implantar > Gerenciar implantações
 *    > lápis (editar) > Versão: "Nova versão" > Implantar.
 *    Se não criar nova versão, o app externo continua vendo o código antigo.
 *
 * 5) TESTE DA URL (cole no navegador, troque SUA_URL)
 *    Leitura:
 *      SUA_URL/exec?action=ping
 *      SUA_URL/exec?action=abas
 *      SUA_URL/exec?action=cabecalho&aba=OUTUBRO
 *      SUA_URL/exec?action=listar&aba=OUTUBRO&limit=5
 *      SUA_URL/exec?action=consultar&aba=OUTUBRO&id=2449
 *
 * 6) ERROS COMUNS
 *    - Tela de login do Google ao abrir a URL: "Quem tem acesso" não está como
 *      "Qualquer pessoa". Refaça a implantação (passo 3).
 *    - "Aba não encontrada": nome com acento/espaço diferente. Use action=abas para ver nomes exatos.
 *    - "Não autorizado": faltou ?token= ou token errado.
 *    - Mudou código e nada mudou: você esqueceu de criar "Nova versão" na implantação.
 */
