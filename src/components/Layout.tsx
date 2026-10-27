import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Handshake, KanbanSquare, LayoutDashboard, Settings, ShoppingCart, Target, Users, UserSquare2 } from 'lucide-react';
import type { ReactNode } from 'react';
import '../index.css';

const GRUPOS: { titulo: string; itens: { to: string; rotulo: string; icone: ReactNode }[] }[] = [
  {
    titulo: 'Análises',
    itens: [
      { to: '/', rotulo: 'Dashboard de vendas', icone: <LayoutDashboard /> },
      { to: '/dashboard-clientes', rotulo: 'Dashboard de clientes', icone: <Handshake /> },
      { to: '/vendas', rotulo: 'Todas as vendas', icone: <ShoppingCart /> },
      { to: '/meta', rotulo: 'Meta', icone: <Target /> },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { to: '/clientes', rotulo: 'Clientes', icone: <Users /> },
      { to: '/oportunidades', rotulo: 'Oportunidades', icone: <KanbanSquare /> },
      { to: '/atividades', rotulo: 'Atividades', icone: <Activity /> },
      { to: '/equipe', rotulo: 'Equipe', icone: <UserSquare2 /> },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [{ to: '/config', rotulo: 'Configurações', icone: <Settings /> }],
  },
];

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">GF</div>
          <div className="brand-txt">
            <h1>Grupo Festa ADM</h1>
            <p>Painel comercial integrado à planilha</p>
          </div>
        </div>
        <nav className="nav">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="nav-bloco">
              <div className="nav-grupo">{g.titulo}</div>
              {g.itens.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.to === '/'}
                  title={i.rotulo}
                  className={({ isActive }) => (isActive ? 'ativo' : '')}
                >
                  {i.icone}
                  <span className="nav-txt">{i.rotulo}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-status">
            <span className="ponto" />
            Planilha mestre
          </div>
          <p>Conectada à fonte oficial. Somente dados reais da API.</p>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
