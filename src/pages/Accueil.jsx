import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/store'

export default function Accueil() {
  const navigate = useNavigate()
  const { cours, membres, historique, inscriptions, loading } = useData()

  const aujourdJour = new Date().getDay()
  const dateStr = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })

  const coursAujourdhui = cours
    .filter(c => c.jour === aujourdJour)
    .sort((a,b) => a.heure.localeCompare(b.heure))
    .map(c => {
      const nb = inscriptions.filter(i=>i.cours_id===c.id).length
      const today = new Date().toISOString().split('T')[0]
      const appelFait = historique.some(h=>h.cours_id===c.id&&h.date===today)
      return { ...c, nb_inscrits:nb, appel_fait:appelFait }
    })

  const chequesAttente = 0 // sera branché sur le module règlements

  const modules = [
    { to:'/cours',      icon:'📋', titre:'Cours & appel',    desc:'Planning, présences, rattrapages', color:'pink' },
    { to:'/membres',    icon:'👥', titre:'Membres',          desc:'Fiches, abonnements, assiduité',   color:'pink' },
    { to:'/reglements', icon:'💶', titre:'Règlements',       desc:'Chèques, espèces, remises banque', color:'lime' },
    { to:'/budget',     icon:'📊', titre:'Budget & finances',desc:'Prévisionnel, réel, trésorerie',   color:'lime' },
    { to:'/factures',   icon:'🧾', titre:'Factures',         desc:'Établir, envoyer, suivre',          color:'both', full:true },
  ]

  return (
    <div>
      <div style={{ background:'#1a1a1a', borderRadius:14, padding:'18px 22px', display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <div style={{ width:52, height:52, borderRadius:'50%', border:'3px solid #FF0099', outline:'3px solid #CCFF00', outlineOffset:1, background:'#A0A0A0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>🏋</div>
        <div>
          <h1 style={{ color:'#fff', fontSize:18, fontWeight:500, margin:'0 0 2px' }}>L'HappyCath Academy</h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, margin:0 }}>Chavanod · Espace de gestion</p>
        </div>
      </div>

      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
        Aujourd'hui — {dateStr}
      </p>
      <div className="card" style={{ marginBottom:20 }}>
        <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Cours du jour</p>
        {loading ? <p style={{ color:'#888', fontSize:14 }}>Chargement…</p>
          : coursAujourdhui.length === 0 ? <p style={{ color:'#888', fontSize:14 }}>Aucun cours aujourd'hui</p>
          : coursAujourdhui.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'0.5px solid rgba(0,0,0,0.07)' }}>
              <span style={{ fontSize:13, fontWeight:500, minWidth:50 }}>{c.heure}</span>
              <span style={{ flex:1, fontSize:14 }}>{c.nom}</span>
              <span style={{ fontSize:12, color:'#888' }}>{c.coach} · {c.nb_inscrits} inscrits</span>
              <button onClick={()=>navigate(`/cours?appel=${c.id}`)}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:8, border:`1px solid ${c.appel_fait?'#aad000':'#FF0099'}`, color:c.appel_fait?'#3a5a00':'#FF0099', background:c.appel_fait?'rgba(204,255,0,0.12)':'transparent', cursor:'pointer' }}>
                {c.appel_fait ? 'Appel fait' : "Faire l'appel"}
              </button>
            </div>
          ))}
      </div>

      <div className="stats-grid" style={{ marginBottom:20 }}>
        <div className="stat-card"><div className="stat-val" style={{ color:'#FF0099' }}>{membres.length}</div><div className="stat-lbl">Membres actifs</div></div>
        <div className="stat-card"><div className="stat-val">{coursAujourdhui.length}</div><div className="stat-lbl">Cours aujourd'hui</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color:chequesAttente>0?'#b45309':'#1a1a1a' }}>{chequesAttente}</div><div className="stat-lbl">Chèques en attente</div></div>
      </div>

      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Modules</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10 }}>
        {modules.map(m => (
          <div key={m.to} onClick={()=>navigate(m.to)}
            style={{ gridColumn:m.full?'span 2':undefined, background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:14, padding:m.full?'14px 16px':16, cursor:'pointer', display:m.full?'flex':'block', alignItems:m.full?'center':undefined, gap:m.full?14:undefined, borderTop:`3px solid ${m.color==='pink'?'#FF0099':m.color==='lime'?'#CCFF00':'transparent'}`, transition:'transform .1s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}>
            <div style={{ fontSize:20, marginBottom:m.full?0:8, background:m.color==='pink'?'rgba(255,0,153,0.1)':'rgba(204,255,0,0.15)', width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{m.icon}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14, fontWeight:500, margin:'0 0 3px' }}>{m.titre}</p>
              <p style={{ fontSize:12, color:'#888', margin:0 }}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
