import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { atualizarPorLinha, cadastrar, excluirPorLinha } from '../lib/api';
import { ABA_ESCRITA } from '../lib/config';
import { derivarClientes, type Cliente } from '../lib/domain';
import { dataCurta, moeda, numero } from '../lib/format';
import { useToast } from '../hooks/useToast';

interface Form {
  Cliente: string;
  CNPJ: string;
  UF: string;
  'Data Lançamento': string;
  'Valor Líquido': string;
  'Nº Ped.': string;
  'Novos Clientes': string;
  'Emp.': string;
  RPI: string;
  'RESP.': string;
}

const FORM_VAZIO: Form = {
  Cliente: '',
  CNPJ: '',
  UF: '',
  'Data Lançamento': '',
  'Valor Líquido': '',
  'Nº Ped.': '',
  'Novos Clientes': '',
  'Emp.': '',
  RPI: '',
  'RESP.': '',
};

export default function Clientes() {
  const { vendas, carregando, erro, recarregar, marcarAtualizando, atualizandoLinhas } = useVendasCtx();
  const { toast, mostrar } = useToast();
  const [busca, setBusca] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [ordenacao, setOrdenacao] = useState<'nome' | 'receita' | 'pedidos' | 'ultima' | 'cnpj'>('nome');
  const [modal, setModal] = useState<null | { modo: 'novo' } | { modo: 'editar'; cliente: Cliente }>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const clientes = useMemo(() => derivarClientes(vendas), [vendas]);
  const ufs = useMemo(() => [...new Set(clientes.map((c) => c.uf).filter(Boolean))].sort(), [clientes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = clientes.filter((c) => {
      if (filtroUF && c.uf !== filtroUF) return false;
      if (!q) return true;
      return c.nome.toLowerCase().includes(q) || c.cnpj.toLowerCase().includes(q) || c.rpi.toLowerCase().includes(q);
    });
    lista = [...lista].sort((a, b) => {
      if (ordenacao === 'nome') return a.nome.localeCompare(b.nome);
      if (ordenacao === 'cnpj') return a.cnpj.localeCompare(b.cnpj);
      if (ordenacao === 'receita') return b.receita - a.receita;
      if (ordenacao === 'pedidos') return b.pedidos - a.pedidos;
      if (ordenacao === 'ultima') {
        const da = new Date(a.ultimoLancamento || 0).getTime();
        const db = new Date(b.ultimoLancamento || 0).getTime();
        return db - da;
      }
      return 0;
    });
    return lista;
  }, [clientes, busca, filtroUF, ordenacao]);

  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setModal({ modo: 'novo' });
  };

  const abrirEditar = (cliente: Cliente) => {
    const v = vendas.find((x) => x._linha === cliente.linhaReferencia);
    setForm({
      Cliente: cliente.nome === '(sem nome)' ? '' : cliente.nome,
      CNPJ: cliente.cnpj,
      UF: cliente.uf,
      'Data Lançamento': v ? String(v['Data Lançamento'] ?? '') : '',
      'Valor Líquido': v ? String(v['Valor Líquido'] ?? '') : '',
      'Nº Ped.': v ? String(v['Nº Ped.'] ?? '') : '',
      'Novos Clientes': v ? String(v['Novos Clientes'] ?? v['C/N'] ?? '') : '',
      'Emp.': v ? String(v['Emp.'] ?? '') : '',
      RPI: cliente.rpi,
      'RESP.': cliente.responsavel,
    });
    setModal({ modo: 'editar', cliente });
  };

  const salvar = async () => {
    if (!form.Cliente.trim()) {
      mostrar('Informe o nome do cliente.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      const registro: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== '') registro[k] = k === 'Valor Líquido' ? Number(v) || 0 : v;
      }
      if (modal && 'modo' in modal && modal.modo === 'editar') {
        const linha = (modal as { cliente: Cliente }).cliente.linhaReferencia;
        marcarAtualizando(linha, true);
        await atualizarPorLinha(ABA_ESCRITA, linha, registro);
        mostrar(`Cliente atualizado na linha ${linha} da planilha.`);
      } else {
        await cadastrar(ABA_ESCRITA, registro);
        mostrar('Cliente cadastrado como nova linha na aba VENDAS.');
      }
      setModal(null);
      await recarregar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : String(e), 'erro');
    } finally {
      setSalvando(false);
      if (modal && 'cliente' in (modal as object)) marcarAtualizando((modal as { cliente: Cliente }).cliente.linhaReferencia, false);
    }
  };

  const excluir = async (cliente: Cliente) => {
    if (!window.confirm(`Excluir a linha ${cliente.linhaReferencia} (${cliente.nome}) da planilha? Isso apaga o pedido de referência.`)) return;
    marcarAtualizando(cliente.linhaReferencia, true);
    try {
      await excluirPorLinha(ABA_ESCRITA, cliente.linhaReferencia);
      mostrar('Linha excluída na API.');
      await recarregar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : String(e), 'erro');
    } finally {
      marcarAtualizando(cliente.linhaReferencia, false);
    }
  };

  if (carregando) return <div className="estado">Carregando clientes da API…</div>;
  if (erro)
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  return (
    <div>
      {toast}
      <div className="topo">
        <div>
          <h2>Clientes</h2>
          <p>
            {filtrados.length} de {clientes.length} clientes • derivados das abas mensais (agrupados por CNPJ/nome) • sem
            dados fictícios
          </p>
        </div>
        <button className="primario" onClick={abrirNovo}>
          <Plus />
          Novo cliente
        </button>
      </div>

      <div className="barra">
        <input
          className="busca"
          placeholder="Buscar por nome, CNPJ ou RPI…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select value={filtroUF} onChange={(e) => setFiltroUF(e.target.value)}>
          <option value="">Todas as UFs</option>
          {ufs.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as 'nome' | 'cnpj' | 'pedidos' | 'receita' | 'ultima')}>
          <option value="nome">Ordenar: Nome (A-Z)</option>
          <option value="cnpj">Ordenar: CNPJ</option>
          <option value="receita">Ordenar: Receita (maior p/ menor)</option>
          <option value="pedidos">Ordenar: Pedidos (maior p/ menor)</option>
          <option value="ultima">Ordenar: Último lançamento (mais recente)</option>
        </select>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="painel">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CNPJ</th>
              <th>UF</th>
              <th>RPI</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Receita</th>
              <th>Último lançamento</th>
              <th>Linha</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.chave}>
                <td>{c.nome}</td>
                <td>{c.cnpj || '—'}</td>
                <td>{c.uf || '—'}</td>
                <td>{c.rpi || '—'}</td>
                <td className="direita">{numero(c.pedidos)}</td>
                <td className="direita">{moeda(c.receita)}</td>
                <td>{dataCurta(c.ultimoLancamento)}</td>
                <td>
                  <span className="pill">{c.linhaReferencia}</span>
                </td>
                <td>
                  <div className="acoes-linha">
                    <button
                      onClick={() => abrirEditar(c)}
                      disabled={atualizandoLinhas.has(c.linhaReferencia)}
                      title="Editar cliente"
                    >
                      <Pencil />
                      Editar
                    </button>
                    <button
                      className="perigo"
                      onClick={() => void excluir(c)}
                      disabled={atualizandoLinhas.has(c.linhaReferencia)}
                      title="Excluir a linha na planilha"
                    >
                      <Trash2 />
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="vazio">
                  Nenhum cliente encontrado para os filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-fundo" onClick={() => !salvando && setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.modo === 'novo' ? 'Novo cliente' : 'Editar cliente'}</h3>
            <p className="sub">
              {modal.modo === 'novo'
                ? `Será inserida uma nova linha na aba ${ABA_ESCRITA} via API (action=cadastrar).`
                : `Será atualizada a linha ${(modal as { cliente: Cliente }).cliente.linhaReferencia} via API (action=atualizar). Apenas campos preenchidos são gravados.`}
            </p>
            <div className="form-grid">
              <div className="campo cheio">
                <label>Cliente *</label>
                <input value={form.Cliente} onChange={(e) => setForm({ ...form, Cliente: e.target.value })} />
              </div>
              <div className="campo">
                <label>CNPJ</label>
                <input value={form.CNPJ} onChange={(e) => setForm({ ...form, CNPJ: e.target.value })} />
              </div>
              <div className="campo">
                <label>UF</label>
                <input value={form.UF} onChange={(e) => setForm({ ...form, UF: e.target.value })} maxLength={2} />
              </div>
              <div className="campo">
                <label>RPI</label>
                <input value={form.RPI} onChange={(e) => setForm({ ...form, RPI: e.target.value })} />
              </div>
              <div className="campo">
                <label>Responsável (RESP.)</label>
                <input value={form['RESP.']} onChange={(e) => setForm({ ...form, 'RESP.': e.target.value })} />
              </div>
              <div className="campo">
                <label>Empresa (Emp.)</label>
                <input value={form['Emp.']} onChange={(e) => setForm({ ...form, 'Emp.': e.target.value })} />
              </div>
              <div className="campo">
                <label>Nº Ped.</label>
                <input value={form['Nº Ped.']} onChange={(e) => setForm({ ...form, 'Nº Ped.': e.target.value })} />
              </div>
              <div className="campo">
                <label>Valor Líquido</label>
                <input value={form['Valor Líquido']} onChange={(e) => setForm({ ...form, 'Valor Líquido': e.target.value })} inputMode="decimal" />
              </div>
              <div className="campo">
                <label>Tipo (C = base, N = novo)</label>
                <select value={form['Novos Clientes']} onChange={(e) => setForm({ ...form, 'Novos Clientes': e.target.value })}>
                  <option value="">—</option>
                  <option value="C">C (cliente base)</option>
                  <option value="N">N (novo)</option>
                </select>
              </div>
            </div>
            <div className="acoes">
              <button onClick={() => setModal(null)} disabled={salvando}>
                Cancelar
              </button>
              <button className="primario" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? 'Enviando…' : 'Salvar na API'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
