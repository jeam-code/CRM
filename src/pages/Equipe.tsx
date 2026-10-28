import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarTudo, type Registro } from '../lib/api';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { campo, ehContabil, valorLiquido } from '../lib/domain';
import { moeda, normalizarNome, numero } from '../lib/format';

interface Membro {
  codigo: string;
  nome: string;
  uf: string;
  equipe: string;
  responsavel: string;
  pedidos: number;
  receita: number;
}

interface ForaEquipe {
  codigo: string;
  nome: string;
  pedidos: number;
  receita: number;
}

interface ResumoResp {
  responsavel: string;
  vendedores: number;
  pedidos: number;
  receita: number;
}

/**
 * Aba Equipe — cadastro real da aba "Equipe" da planilha (nomes, UF, equipe e
 * responsável atualizados pelo gestor) cruzado com as vendas contábeis das abas
 * mensais pelo COD. VENDEDOR. Códigos com venda que não estão na aba Equipe
 * aparecem em painel próprio. Nenhum nome ou valor é inventado.
 */
export default function Equipe() {
  const { vendas, carregando: vendasCarregando, erro: vendasErro, recarregar, total } = useVendasCtx();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [eqCarregando, setEqCarregando] = useState(true);
  const [eqErro, setEqErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [respFiltro, setRespFiltro] = useState('');
  const [soVendas, setSoVendas] = useState(false);

  const carregarEquipe = useCallback(async () => {
    setEqCarregando(true);
    setEqErro(null);
    try {
      const r = await listarTudo('Equipe');
      setRegistros(r.registros);
    } catch (e) {
      setEqErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEqCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarEquipe();
  }, [carregarEquipe]);

  const { membros, fora, resumo, totalPedidos, totalReceita } = useMemo(() => {
    // vendas contábeis por código de vendedor
    const agg = new Map<string, { pedidos: number; receita: number }>();
    const nomesVenda = new Map<string, string>();
    for (const v of vendas) {
      const cod = campo(v, 'COD. VENDEDOR');
      if (cod === '') continue;
      if (!nomesVenda.has(cod)) {
        const rpi = campo(v, 'RPI');
        if (rpi !== '') nomesVenda.set(cod, rpi);
      }
      if (!ehContabil(v)) continue;
      const a = agg.get(cod) ?? { pedidos: 0, receita: 0 };
      a.pedidos += 1;
      a.receita += valorLiquido(v);
      agg.set(cod, a);
    }

    const roster = new Set<string>();
    const lista: Membro[] = [];
    for (const r of registros) {
      const codigo = String(r['CODIGO'] ?? '').trim();
      const nome = String(r['VENDEDOR'] ?? '').trim();
      if (codigo === '' || nome === '') continue;
      roster.add(codigo);
      const a = agg.get(codigo) ?? { pedidos: 0, receita: 0 };
      lista.push({
        codigo,
        nome,
        uf: String(r['UF'] ?? '').trim(),
        equipe: String(r['EQUIPE'] ?? '').trim(),
        responsavel: String(r['RESPONSAVEL'] ?? '').trim() || '—',
        pedidos: a.pedidos,
        receita: a.receita,
      });
    }
    lista.sort(
      (a, b) => a.responsavel.localeCompare(b.responsavel, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'),
    );

    const foraLista: ForaEquipe[] = [];
    for (const [codigo, a] of agg) {
      if (roster.has(codigo)) continue;
      foraLista.push({
        codigo,
        nome: nomesVenda.get(codigo) ?? `COD ${codigo}`,
        pedidos: a.pedidos,
        receita: a.receita,
      });
    }
    foraLista.sort((a, b) => b.receita - a.receita);

    const resumoMap = new Map<string, { vendedores: number; pedidos: number; receita: number }>();
    for (const m of lista) {
      const r = resumoMap.get(m.responsavel) ?? { vendedores: 0, pedidos: 0, receita: 0 };
      r.vendedores += 1;
      r.pedidos += m.pedidos;
      r.receita += m.receita;
      resumoMap.set(m.responsavel, r);
    }
    const resumoLista: ResumoResp[] = [...resumoMap.entries()]
      .map(([responsavel, r]) => ({ responsavel, ...r }))
      .sort((a, b) => b.receita - a.receita || b.vendedores - a.vendedores);

    const somaPedidos = lista.reduce((s, m) => s + m.pedidos, 0) + foraLista.reduce((s, f) => s + f.pedidos, 0);
    const somaReceita = lista.reduce((s, m) => s + m.receita, 0) + foraLista.reduce((s, f) => s + f.receita, 0);

    return { membros: lista, fora: foraLista, resumo: resumoLista, totalPedidos: somaPedidos, totalReceita: somaReceita };
  }, [registros, vendas]);

  const responsaveis = useMemo(
    () => [...new Set(membros.map((m) => m.responsavel))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [membros],
  );

  const filtrados = useMemo(() => {
    const b = normalizarNome(busca);
    const cod = busca.trim();
    return membros.filter((m) => {
      if (respFiltro !== '' && m.responsavel !== respFiltro) return false;
      if (soVendas && m.pedidos === 0) return false;
      if (b === '') return true;
      return normalizarNome(m.nome).includes(b) || (cod !== '' && m.codigo.includes(cod));
    });
  }, [membros, busca, respFiltro, soVendas]);

  const somaFiltro = useMemo(
    () => filtrados.reduce((s, m) => ({ pedidos: s.pedidos + m.pedidos, receita: s.receita + m.receita }), { pedidos: 0, receita: 0 }),
    [filtrados],
  );

  if (vendasCarregando || eqCarregando) return <div className="estado">Carregando equipe da API…</div>;
  if (vendasErro || eqErro) {
    return (
      <div className="estado">
        <p>Erro: {vendasErro ?? eqErro}</p>
        <button
          onClick={() => {
            void recarregar();
            void carregarEquipe();
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Equipe</h2>
          <p>
            {numero(membros.length)} pessoas na aba Equipe da planilha • pedidos e receita = vendas contábeis das abas
            mensais por COD. VENDEDOR ({numero(total)} lançamentos lidos) • {numero(fora.length)} códigos com venda
            fora da aba Equipe
          </p>
        </div>
        <BotaoAtualizar
          aoAtualizar={() => {
            void recarregar();
            void carregarEquipe();
          }}
        />
      </div>

      <div className="painel">
        <h3>Resumo por responsável</h3>
        <table>
          <thead>
            <tr>
              <th>Responsável</th>
              <th className="direita">Vendedores</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Receita</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => (
              <tr key={r.responsavel}>
                <td>{r.responsavel}</td>
                <td className="direita">{numero(r.vendedores)}</td>
                <td className="direita">{numero(r.pedidos)}</td>
                <td className="direita">{moeda(r.receita)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="direita">{numero(membros.length)}</td>
              <td className="direita">{numero(totalPedidos)}</td>
              <td className="direita">{moeda(totalReceita)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="sub">Inclui vendedores marcados como “Inativo” na planilha.</p>
      </div>

      <div className="painel">
        <h3>Vendedores</h3>
        <div className="barra">
          <input
            className="busca"
            placeholder="Buscar vendedor ou código…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select value={respFiltro} onChange={(e) => setRespFiltro(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={soVendas} onChange={(e) => setSoVendas(e.target.checked)} />
            Somente com vendas
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Responsável</th>
              <th>Código</th>
              <th>Vendedor</th>
              <th>UF</th>
              <th>Equipe</th>
              <th className="direita">Pedidos</th>
              <th className="direita">Receita</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr key={m.codigo}>
                <td>{m.responsavel}</td>
                <td>{m.codigo}</td>
                <td>{m.nome}</td>
                <td>{m.uf || '—'}</td>
                <td>{m.equipe || '—'}</td>
                <td className="direita">{numero(m.pedidos)}</td>
                <td className="direita">{moeda(m.receita)}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="vazio">
                  Nenhum vendedor encontrado para os filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="direita">
                  Total exibido ({numero(filtrados.length)} vendedores)
                </td>
                <td className="direita">{numero(somaFiltro.pedidos)}</td>
                <td className="direita">{moeda(somaFiltro.receita)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {fora.length > 0 && (
        <div className="painel">
          <h3>Códigos com venda fora da aba Equipe</h3>
          <p className="sub">
            Vendas contábeis do ano cujo COD. VENDEDOR não está cadastrado na aba Equipe (ou usa outro código).
          </p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome na venda (RPI)</th>
                <th className="direita">Pedidos</th>
                <th className="direita">Receita</th>
              </tr>
            </thead>
            <tbody>
              {fora.map((f) => (
                <tr key={f.codigo}>
                  <td>{f.codigo}</td>
                  <td>{f.nome}</td>
                  <td className="direita">{numero(f.pedidos)}</td>
                  <td className="direita">{moeda(f.receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
