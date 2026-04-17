import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import Membres from './pages/Membres'
import Cours from './pages/Cours'
import { Reglements, Budget, Factures } from './pages/AutresPages'
import './index.css'

export default function App() {
  return (
    <BrowserRouter basename="/happycath-app">
      <Layout>
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/cours" element={<Cours />} />
          <Route path="/membres" element={<Membres />} />
          <Route path="/reglements" element={<Reglements />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/factures" element={<Factures />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
