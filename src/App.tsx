import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DashboardClientes from './pages/DashboardClientes';
import Clientes from './pages/Clientes';
import Vendas from './pages/Vendas';
import Meta from './pages/Meta';
import Oportunidades from './pages/Oportunidades';
import Atividades from './pages/Atividades';
import Equipe from './pages/Equipe';
import Config from './pages/Config';

/** HashRouter funciona tanto no Electron (arquivo local) quanto na web. */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard-clientes" element={<DashboardClientes />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="vendas" element={<Vendas />} />
          <Route path="meta" element={<Meta />} />
          <Route path="oportunidades" element={<Oportunidades />} />
          <Route path="atividades" element={<Atividades />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="config" element={<Config />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
