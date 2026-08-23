import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './lib/store'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import Membres from './pages/Membres'
import Cours from './pages/Cours'
import Dashboard from './pages/Dashboard'
import Reglements from './pages/Reglements'
import Inscriptions from './pages/Inscriptions'
import Budget from './pages/Budget'
import Stages from './pages/Stages'
import Resultats from './pages/Resultats'
import './index.css'

export default function App() {
  return (
    <BrowserRouter basename="/happycath-app">
      <DataProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cours" element={<Cours />} />
            <Route path="/membres" element={<Membres />} />
            <Route path="/inscriptions" element={<Inscriptions />} />
            <Route path="/reglements" element={<Reglements />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/stages" element={<Stages />} />
            <Route path="/resultats" element={<Resultats />} />
          </Routes>
        </Layout>
      </DataProvider>
    </BrowserRouter>
  )
}
