import { KeyRound, PlugZap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL, getApiToken, setApiToken } from '../lib/config';
import { listarAbas, obterCabecalho } from '../lib/api';
import { ABA_ESCRITA } from '../lib/config';

export default function Config() {
  const [token, setToken] = useState('');
  const [abas, setAbas] = useState<string[]>([]);
  const [campos, setCampos] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setToken(getApiToken());
  }, []);

  const testar = async () => {
    setCarregando(true);
    setMsg('');
    try {
      const a = await listarAbas();
      setAbas(a);
      try {
        setCampos(await obterCabecalho(ABA_ESCRITA));
      } catch {
        setCampos([]);
      }
      setMsg(`API online. ${a.length} abas visíveis.`);
    } catch (e) {
      setMsg(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div>
      <div className="topo">
        <div>
          <h2>Configurações</h2>
          <p>Conexão com a API e preparação para o instalador.</p>
        </div>
      </div>

      <div className="painel">
        <h3>Conexão com a API</h3>
        <p className="sub">URL fixa (única fonte de dados):</p>
        <input value={API_BASE_URL} readOnly className="mono" style={{ width: '100%' }} />
        <div className="barra" style={{ marginTop: 12 }}>
          <input
            type="password"
            placeholder="Token da API (obrigatório para salvar/excluir)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ minWidth: 300 }}
          />
          <button
            className="primario"
            onClick={() => {
              setApiToken(token);
              setMsg('Token salvo neste computador (localStorage).');
            }}
          >
            <KeyRound />
            Salvar token
          </button>
          <button onClick={() => void testar()} disabled={carregando}>
            <PlugZap />
            {carregando ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>
        {msg && <p className="sub">{msg}</p>}
        <p className="sub">
          Escrita (cadastrar/atualizar/excluir) exige o token configurado no Apps Script (API_TOKEN). Leitura é
          aberta. Se aparecer “Não autorizado”, confira o token ou gere nova versão da implantação.
        </p>
      </div>

      {abas.length > 0 && (
        <div className="painel">
          <h3>Abas visíveis na planilha</h3>
          <p className="sub">{abas.join(' • ')}</p>
        </div>
      )}
      {campos.length > 0 && (
        <div className="painel">
          <h3>Campos da aba {ABA_ESCRITA}</h3>
          <p className="sub">{campos.filter(Boolean).join(' • ')}</p>
        </div>
      )}

      <div className="painel">
        <h3>Gerar instalador Windows</h3>
        <p className="sub">Após `npm install`, rode:</p>
        <p className="sub">
          <code>npm run dist</code> — gera instalador NSIS + portátil em <code>release/</code> via electron-builder.
        </p>
        <p className="sub">
          Pré-requisitos: Node 20+, ícone em <code>build/icon.ico</code> (opcional). Assinatura de código é opcional
          para uso interno.
        </p>
      </div>
    </div>
  );
}
