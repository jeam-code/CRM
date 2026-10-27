import { useMemo, useState } from 'react';
import { BotaoAtualizar } from '../components/ui';
import { useVendasCtx } from '../state/VendasContext';
import { derivarAtividades } from '../lib/domain';
import { dataCurta, dataISO, moeda } from '../lib/format';

export default function Atividades() {
  const { vendas, carregando, erro, recarregar } = useVendasCtx();
  const [resp, setResp] = useState('');
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');

  const atividades = useMemo(() => derivarAtividades(vendas), [vendas]);

  const responsaveis = useMemo(() => [...new Set(atividades.map((a) => a.responsavel).filter((x) => x && x !== '—'))].sort(), [atividades]);
  const tipos = useMemo(() => [...new Set(atividades.map((a) => a.tipo))].sort(), [atividades]);
  const statusList = useMemo(() => [...new Set(atividades.map((a) => a.status))].sort(), [atividades]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return atividades.filter((a) => {
      if (resp && a.responsavel !== resp) return false;
      if (tipo && a.tipo !== tipo) return false;
      if (status && a.status !== status) return false;
      if (q && !a.titulo.toLowerCase().includes(q)) return false;
      if (dataIni || dataFim) {
        const iso = dataISO(a.data);
        if (!iso) return false;
        if (dataIni && iso < dataIni) return false;
        if (dataFim && iso > dataFim) return false;
      }
      return true;
    });
  }, [atividades, resp, tipo, status, dataIni, dataFim, busca]);

  if (carregando) return <div className="estado">Carregando atividades da API…</div>;
  if (erro)
    return (
      <div className="estado">
        <p>Erro: {erro}</p>
        <button onClick={() => void recarregar()}>Tentar novamente</button>
      </div>
    );

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Atividades</h2>
          <p>
            Cada atividade é um lançamento real das abas mensais • responsável = RPI • tipo = VELA8/PROMO2/SAZONAL • status =
            tipo de cliente (C/N) • data = Data Lançamento • marcadores (bonificação/expositor/cancelado/troca) não entram.
          </p>
        </div>
        <BotaoAtualizar aoAtualizar={() => void recarregar()} />
      </div>

      <div className="barra">
        <input className="busca" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={resp} onChange={(e) => setResp(e.target.value)}>
          <option value="">Responsável: todos</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo: todos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status: todos</option>
          {statusList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} title="Data inicial" />
        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Data final" />
        <button
          onClick={() => {
            setResp('');
            setTipo('');
            setStatus('');
            setDataIni('');
            setDataFim('');
            setBusca('');
          }}
        >
          Limpar
        </button>
      </div>

      <div className="painel">
        <h3>
          {filtradas.length} atividades
        </h3>
        <table>
          <thead>
            <tr>
              <th>Atividade</th>
              <th>Responsável</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Data</th>
              <th className="direita">Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.slice(0, 200).map((a, idx) => (
              <tr key={`${a.id}-${idx}`}>
                <td>{a.titulo}</td>
                <td>{a.responsavel}</td>
                <td>{a.tipo}</td>
                <td>
                  <span className="pill">{a.status}</span>
                </td>
                <td>{dataCurta(a.data)}</td>
                <td className="direita">{moeda(a.valor)}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhuma atividade para os filtros. (Dados 100% da API — nada inventado.)
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtradas.length > 200 && <p className="sub">Mostrando 200 de {filtradas.length} — refine os filtros.</p>}
      </div>
    </div>
  );
}
