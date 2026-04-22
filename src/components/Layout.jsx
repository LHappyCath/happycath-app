import { NavLink, useLocation } from 'react-router-dom'
import { useData } from '../lib/store'

const NAV_ITEMS = [
  { to: '/',           icon: '🏠', label: 'Accueil',         section: null },
  { to: '/dashboard',  icon: '📈', label: 'Tableau de bord', section: null },
  { to: '/cours',      icon: '📋', label: 'Cours & appel',   section: 'Terrain' },
  { to: '/membres',    icon: '👥', label: 'Membres',         section: null },
  { to: '/reglements', icon: '💶', label: 'Règlements',      section: 'Gestion' },
  { to: '/budget',     icon: '📊', label: 'Budget',          section: null },
  { to: '/factures',   icon: '🧾', label: 'Factures',        section: null },
]

const BOTTOM_NAV = [
  { to: '/',          icon: '🏠', label: 'Accueil' },
  { to: '/dashboard', icon: '📈', label: 'Stats' },
  { to: '/cours',     icon: '📋', label: 'Cours' },
  { to: '/membres',   icon: '👥', label: 'Membres' },
  { to: '/budget',    icon: '📊', label: 'Budget' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { online, syncing, queueSize } = useData()
  const currentPage = NAV_ITEMS.find(n => n.to === location.pathname)?.label || "L'HappyCath"
  let lastSection = null

  const syncLabel = syncing ? 'Synchronisation…'
    : !online && queueSize > 0 ? `Hors ligne · ${queueSize} en attente`
    : !online ? 'Hors ligne'
    : 'Synchronisé'

  const syncColor = syncing ? '#CCFF00'
    : !online && queueSize > 0 ? '#f59e0b'
    : !online ? '#888'
    : '#CCFF00'

  return (
    <div className="app-layout">

      {/* Bandeau hors ligne */}
      {!online && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:500, background:'#1a1a1a', color: queueSize>0?'#f59e0b':'#CCFF00', fontSize:12, fontWeight:500, textAlign:'center', padding:'6px 16px', letterSpacing:'0.03em' }}>
          {queueSize > 0
            ? `Hors ligne — ${queueSize} modification${queueSize>1?'s':''} en attente de synchronisation`
            : 'Hors ligne — données du dernier chargement'}
        </div>
      )}

      {/* Sidebar desktop */}
      <aside className="sidebar" style={{ top: online ? 0 : 28 }}>
        <div className="sidebar-logo">
          <div className="sidebar-badge">🏋</div>
          <h1>L'HappyCath<br />Academy</h1>
          <span>Chavanod</span>
        </div>
        <nav>
          {NAV_ITEMS.map(item => {
            const showSection = item.section && item.section !== lastSection
            if (item.section) lastSection = item.section
            return (
              <div key={item.to}>
                {showSection && <div className="nav-section">{item.section}</div>}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              </div>
            )
          })}
        </nav>
        <div className="sync-status">
          <div className="sync-dot" style={{ background: syncColor }} />
          <span style={{ color: syncColor }}>{syncLabel}</span>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="mobile-topbar" style={{ top: online ? 0 : 28 }}>
        <div className="sidebar-badge" style={{ width:32, height:32, fontSize:14, marginBottom:0 }}>🏋</div>
        <h2>{currentPage}</h2>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:syncColor }}>
          <div className="sync-dot" style={{ background:syncColor }} />
          {!online && queueSize > 0 ? `${queueSize} att.` : online ? 'En ligne' : 'Hors ligne'}
        </div>
      </div>

      {/* Contenu */}
      <main className="main-content">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {BOTTOM_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bnav-item${isActive ? ' active' : ''}`}
            >
              <span className="bnav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
