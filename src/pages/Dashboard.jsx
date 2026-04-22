import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'

const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function couleurTaux(t) {
  if (t >= 80) return '#0f6e56'
  if (t >= 60) return '#BA7517'
  return '#E24B4A'
}

function ColHeader({ label, col, sortCol, sortDir, onSort, center }) {
  const active = sortCol === col
  return (
    <span onClick={() => onSort(col)} style={{ cursor:'pointer', display:'flex', alignItems:'center', justifyContent: center?'center':'flex-start', gap:4, userSelect:'none', color: active?'#FF0099':'#aaa', fontWeight: active?'600':'500' }}>
      {label}
      <span style={{ fontSize:9, opacity: active?1:0.4 }}>{active && sortDir==='asc' ? '▲' : '▼'}</span>
    </span>
  )
}

function ModalDetail({ titre, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:620, maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:17, fontWeight:500, margin:0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function KpiCard({ val, lbl, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'14px 16px', cursor:onClick?'pointer':'default', transition:'border-color .15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor='#FF0099')}
      onMouseLeave={e => e.currentTarget.style.borderColor='rgba(0,0,0,0.08)'}>
      <div style={{ fontSize:28, fontWeight:500, color:color||'#1a1a1a', marginBottom:2 }}>{val}</div>
      <div style={{ fontSize:12, color:'#888' }}>{lbl}</div>
      {onClick && <div style={{ fontSize:10, color:'#FF0099', marginTop:4 }}>Voir →</div>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { cours: storeC, membres: storeM, inscriptions: storeI, historique: storeH, abonnements: storeA, loading: storeLoading } = useData()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const [coursSort, setCoursSort] = useState({ col:'nom', dir:'asc' })
  const [membresSort, setMembresSort] = useState({ col:'nom', dir:'asc' })
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [filtreCours, setFiltreCours] = useState('tous')
  const [searchMembre, setSearchMembre] = useState('')

  const CACHE_KEY = 'happycath_dashboard_cache'

  const loadDashboard = useCallback(async () => {
    // Utiliser les données du store global — toujours à jour
    const membres = storeM, cours = storeC, inscriptions = storeI, historique = storeH, abonnements = storeA
    if (!membres.length && !cours.length) {
      // Fallback cache si store vide
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached) { setData(cached); setLoading(false); return }
      } catch(e) {}
      setLoading(false); return
    }
      { data: abonnements }
    ] = await Promise.all([
      supabase.from('membres').select('*').eq('actif', true).order('nom'),
      supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure'),
    // Stats par cours
    const statsCours = (cours || []).map(c => {
      const inscrits = (inscriptions || []).filter(i => i.cours_id === c.id)
      const appels = (historique || []).filter(h => h.cours_id === c.id)
      let totalPresences = 0, totalPossible = 0
      appels.forEach(h => {
        const nb = (h.presents||[]).length + (h.guests||[]).filter(g=>g.type==='rattrapage').length
        totalPresences += nb
        totalPossible += inscrits.length
      })
      const taux = totalPossible > 0 ? Math.round(totalPresences / totalPossible * 100) : null
      const capacite = c.capacite_max || 15
      const tauxRemplissage = Math.round(inscrits.length / capacite * 100)
      return {
        ...c,
        nb_inscrits: inscrits.length,
        nb_appels: appels.length,
        taux_assiduite: taux,
        taux_remplissage: tauxRemplissage,
        capacite_max: capacite,
      }
    })

    // Stats par membre
    const statsMembres = (membres || []).map(m => {
      const inscMembre = (inscriptions || []).filter(i => i.membre_id === m.id)
      const courIds = inscMembre.map(i => i.cours_id)
      const aboActif = (abonnements || []).find(a => a.membre_id === m.id && a.statut === 'actif')

      let totalSuivis=0, totalPossible=0, totalManques=0, totalRattrapages=0

      courIds.forEach(cId => {
        const appels = (historique || []).filter(h => {
          if (h.cours_id !== cId) return false
          if (aboActif) return h.date >= aboActif.date_debut && h.date <= aboActif.date_fin
          return true
        })
        appels.forEach(h => {
          const estPresent = (h.presents||[]).includes(m.id)
          const estRattrapage = (h.guests||[]).some(g=>g.membreId===m.id&&g.type==='rattrapage')
          totalPossible++
          if (estPresent||estRattrapage) totalSuivis++
          else totalManques++
          if (estRattrapage) totalRattrapages++
        })
      })

      ;(historique||[]).forEach(h => {
        if (courIds.includes(h.cours_id)) return
        const isRattrapage = (h.guests||[]).some(g=>g.membreId===m.id&&g.type==='rattrapage')
        if (isRattrapage) totalRattrapages++
      })

      const taux = totalPossible > 0 ? Math.round(totalSuivis / totalPossible * 100) : null
      const tauxGlobal = totalPossible > 0 ? Math.round((totalSuivis + totalRattrapages) / totalPossible * 100) : null
      const solde = Math.max(0, totalManques - totalRattrapages)
      const dernierCours = (historique||[]).find(h => (h.presents||[]).includes(m.id) || (h.guests||[]).some(g=>g.membreId===m.id))
      const joursAbsent = dernierCours ? Math.floor((Date.now() - new Date(dernierCours.date+'T12:00:00').getTime()) / 86400000) : 999
      const abo = (abonnements||[]).find(a=>a.membre_id===m.id&&a.statut==='actif')

      return { ...m, taux, tauxGlobal, solde, totalSuivis, totalManques, totalRattrapages, joursAbsent, abo, courIds }
    })

    const tauxMoyen = statsMembres.filter(m=>m.taux!==null).reduce((s,m)=>s+m.taux,0) / Math.max(1, statsMembres.filter(m=>m.taux!==null).length)
    const membresFaibles = statsMembres.filter(m=>m.taux!==null&&m.taux<40)
    const membresAbsents = statsMembres.filter(m=>m.joursAbsent>30&&m.joursAbsent<900)
    const totalRattrapages = statsMembres.reduce((s,m)=>s+m.solde,0)
    const coursForts = statsCours.filter(c=>c.taux_assiduite!==null&&c.taux_assiduite>=80)

    const result = { nbMembres:membres?.length||0, nbCours:cours?.length||0, tauxMoyen:Math.round(tauxMoyen), totalRattrapages, statsCours, statsMembres, membresFaibles, membresAbsents, coursForts, cours:cours||[], timestamp:Date.now() }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)) } catch(e) {}
    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => { 
    if (!storeLoading) loadDashboard() 
  }, [loadDashboard, storeLoading, storeM, storeC, storeH, storeI, storeA])

  function sortData(arr, col, dir) {
    return [...arr].sort((a, b) => {
      let va = a[col], vb = b[col]
      if (va === null || va === undefined) va = -1
      if (vb === null || vb === undefined) vb = -1
      if (typeof va === 'string') return dir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return dir==='asc' ? va - vb : vb - va
    })
  }

  function toggleSort(current, col, setFn) {
    setFn(prev => ({ col, dir: prev.col===col && prev.dir==='asc' ? 'desc' : 'asc' }))
  }

  if (loading) return <div style={{ padding:20, color:'#888', fontSize:14 }}>Calcul des statistiques…</div>
  if (!data) return <div style={{ padding:20, color:'#888', fontSize:14 }}>Impossible de charger les données</div>

  // Cours triés
  const coursTries = sortData(data.statsCours, coursSort.col, coursSort.dir)

  // Membres filtrés + triés
  const membresFiltres = sortData(
    data.statsMembres.filter(m => {
      if (filtreStatut === 'faibles' && (m.taux === null || m.taux >= 40)) return false
      if (filtreStatut === 'rattrapages' && m.solde === 0) return false
      if (filtreStatut === 'absents' && (m.joursAbsent <= 30 || m.joursAbsent >= 900)) return false
      if (filtreCours !== 'tous' && !(m.courIds||[]).includes(filtreCours)) return false
      if (searchMembre && !m.nom.toLowerCase().includes(searchMembre.toLowerCase())) return false
      return true
    }),
    membresSort.col, membresSort.dir
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p style={{ fontSize:13, color:'#888', marginTop:2 }}>Saison 2025/2026</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setModal('fin_saison')} style={{ padding:'7px 14px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:13 }}>Fin de saison</button>
          <button onClick={loadDashboard} style={{ padding:'7px 14px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:13 }}>↻</button>
        </div>
      </div>

      {/* KPIs */}
      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Chiffres clés</p>
      <div className="stats-grid" style={{ marginBottom:20 }}>
        <KpiCard val={data.nbMembres} lbl="Membres actifs" color="#FF0099" />
        <KpiCard val={data.nbCours} lbl="Cours / semaine" />
        <KpiCard val={data.tauxMoyen > 0 ? `${data.tauxMoyen}%` : '—'} lbl="Assiduité moyenne" color={data.tauxMoyen>0?couleurTaux(data.tauxMoyen):'#ccc'} onClick={() => setModal('membres_faibles')} />
        <KpiCard val={data.totalRattrapages||'—'} lbl="Cours à rattraper" color={data.totalRattrapages>50?'#b45309':'#1a1a1a'} onClick={() => setModal('rattrapages')} />
      </div>

      {/* Alertes */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
        {data.membresFaibles.length > 0 && (
          <div onClick={() => setModal('membres_faibles')} style={{ background:'#fef2f2', border:'0.5px solid #fca5a5', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <span style={{ fontSize:13, color:'#E24B4A', flex:1 }}>⚠ {data.membresFaibles.length} membre{data.membresFaibles.length>1?'s':''} avec assiduité &lt; 40%</span>
            <span style={{ fontSize:11, color:'#E24B4A' }}>Voir →</span>
          </div>
        )}
        {data.membresAbsents.length > 0 && (
          <div onClick={() => setModal('absents')} style={{ background:'#fff8e6', border:'0.5px solid #fcd34d', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <span style={{ fontSize:13, color:'#b45309', flex:1 }}>⏰ {data.membresAbsents.length} membre{data.membresAbsents.length>1?'s':''} absent depuis plus de 30 jours</span>
            <span style={{ fontSize:11, color:'#b45309' }}>Voir →</span>
          </div>
        )}
        {data.coursForts.length > 0 && (
          <div style={{ background:'rgba(29,158,117,0.08)', border:'0.5px solid #6ee7b7', borderRadius:10, padding:'10px 14px' }}>
            <span style={{ fontSize:13, color:'#0f6e56' }}>🎯 {data.coursForts.length} cours avec assiduité &gt; 80%</span>
          </div>
        )}
      </div>

      {/* ── TABLEAU COURS FUSIONNÉ ── */}
      <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:16, marginBottom:12 }}>
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 2px' }}>Cours — assiduité & remplissage</p>
          <p style={{ fontSize:11, color:'#bbb', margin:0 }}>Cliquez sur un en-tête pour trier</p>
        </div>

        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 90px 80px', gap:8, padding:'6px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:11 }}>
          <ColHeader label="Cours (jour · heure)" col="nom" sortCol={coursSort.col} sortDir={coursSort.dir} onSort={col=>toggleSort(coursSort,col,setCoursSort)} />
          <ColHeader label="Coach" col="coach" sortCol={coursSort.col} sortDir={coursSort.dir} onSort={col=>toggleSort(coursSort,col,setCoursSort)} center />
          <ColHeader label="Inscrits" col="nb_inscrits" sortCol={coursSort.col} sortDir={coursSort.dir} onSort={col=>toggleSort(coursSort,col,setCoursSort)} center />
          <ColHeader label="Remplissage" col="taux_remplissage" sortCol={coursSort.col} sortDir={coursSort.dir} onSort={col=>toggleSort(coursSort,col,setCoursSort)} center />
          <ColHeader label="Assiduité" col="taux_assiduite" sortCol={coursSort.col} sortDir={coursSort.dir} onSort={col=>toggleSort(coursSort,col,setCoursSort)} center />
        </div>

        {coursTries.map(c => {
          const rColor = c.taux_remplissage >= 80 ? '#FF0099' : c.taux_remplissage >= 60 ? '#BA7517' : '#E24B4A'
          const aColor = c.taux_assiduite !== null ? couleurTaux(c.taux_assiduite) : '#ccc'
          return (
            <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 90px 80px', gap:8, padding:'9px 0', borderTop:'0.5px solid #f8f8f8', alignItems:'center' }}>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:500, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nom}</p>
                <p style={{ fontSize:11, color:'#aaa', margin:0 }}>{JOURS[c.jour]} {c.heure}</p>
              </div>
              <span style={{ fontSize:12, color:'#888', textAlign:'center' }}>{c.coach}</span>
              <span style={{ fontSize:13, fontWeight:500, textAlign:'center' }}>{c.nb_inscrits}<span style={{ fontSize:11, color:'#aaa', fontWeight:400 }}>/{c.capacite_max}</span></span>
              <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                <div style={{ width:36, height:5, background:'#f0f0f0', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
                  <div style={{ width:`${Math.min(100,c.taux_remplissage)}%`, height:'100%', background:rColor, borderRadius:3 }}/>
                </div>
                <span style={{ fontSize:12, fontWeight:500, color:rColor, minWidth:28 }}>{c.taux_remplissage}%</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                {c.taux_assiduite !== null ? <>
                  <div style={{ width:36, height:5, background:'#f0f0f0', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${c.taux_assiduite}%`, height:'100%', background:aColor, borderRadius:3 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:aColor, minWidth:28 }}>{c.taux_assiduite}%</span>
                </> : <span style={{ fontSize:11, color:'#ccc' }}>—</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── TABLEAU MEMBRES ── */}
      <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:16 }}>
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 12px' }}>
          Membres ({membresFiltres.length}{filtreCours!=='tous'||filtreStatut!=='tous'||searchMembre?` / ${data.statsMembres.length}`:''})
        </p>

        {/* Filtres */}
        <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
          <input type="text" placeholder="Rechercher…" value={searchMembre} onChange={e=>setSearchMembre(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:12, width:140 }} />

          {/* Filtre par cours */}
          <select value={filtreCours} onChange={e=>setFiltreCours(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:12, background:'#fff', color:'#666', cursor:'pointer' }}>
            <option value="tous">Tous les cours</option>
            {data.cours.map(c => <option key={c.id} value={c.id}>{c.nom} — {JOURS[c.jour]} {c.heure}</option>)}
          </select>

          {/* Filtre statut */}
          {['tous','faibles','rattrapages','absents'].map(f => (
            <button key={f} onClick={() => setFiltreStatut(f)}
              style={{ fontSize:11, padding:'5px 10px', borderRadius:10, border:`0.5px solid ${filtreStatut===f?'#FF0099':'rgba(0,0,0,0.15)'}`, background:filtreStatut===f?'#FF0099':'transparent', color:filtreStatut===f?'#fff':'#666', cursor:'pointer' }}>
              {f==='tous'?'Tous':f==='faibles'?'< 40%':f==='rattrapages'?'À rattraper':'Absents'}
            </button>
          ))}
        </div>

        {/* Header tableau */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px 70px', gap:8, padding:'6px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:11 }}>
          <ColHeader label="Membre" col="nom" sortCol={membresSort.col} sortDir={membresSort.dir} onSort={col=>toggleSort(membresSort,col,setMembresSort)} />
          <ColHeader label="Abonnement" col="abonnement" sortCol={membresSort.col} sortDir={membresSort.dir} onSort={col=>toggleSort(membresSort,col,setMembresSort)} center />
          <ColHeader label="Par cours" col="taux" sortCol={membresSort.col} sortDir={membresSort.dir} onSort={col=>toggleSort(membresSort,col,setMembresSort)} center />
          <ColHeader label="Globale" col="tauxGlobal" sortCol={membresSort.col} sortDir={membresSort.dir} onSort={col=>toggleSort(membresSort,col,setMembresSort)} center />
          <ColHeader label="Rattrap." col="solde" sortCol={membresSort.col} sortDir={membresSort.dir} onSort={col=>toggleSort(membresSort,col,setMembresSort)} center />
        </div>

        {membresFiltres.map(m => {
          const c = m.taux !== null ? couleurTaux(m.taux) : '#ccc'
          // Assiduité globale = (cours suivis + rattrapages) / (cours suivis + cours manqués)
          const total = m.totalSuivis + m.totalManques
          const tauxGlobal = total > 0 ? Math.round((m.totalSuivis + m.totalRattrapages) / total * 100) : null
          const cg = tauxGlobal !== null ? couleurTaux(tauxGlobal) : '#ccc'
          const aboLabel = m.abo ? m.abo.type : (m.abonnement||'').split('·')[0].trim().substring(0,10)||'—'
          return (
            <div key={m.id}
              onClick={() => navigate('/membres', { state: { membreId: m.id } })}
              style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px 70px', gap:8, padding:'8px 0', borderTop:'0.5px solid #f8f8f8', cursor:'pointer', alignItems:'center' }}
              onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.nom}</span>
              <span style={{ fontSize:11, color:'#888', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{aboLabel}</span>
              {/* Assiduité par cours */}
              <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                {m.taux !== null ? <>
                  <div style={{ width:24, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${m.taux}%`, height:'100%', background:c, borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:c }}>{m.taux}%</span>
                </> : <span style={{ fontSize:11, color:'#ddd' }}>—</span>}
              </div>
              {/* Assiduité globale */}
              <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                {tauxGlobal !== null ? <>
                  <div style={{ width:24, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${tauxGlobal}%`, height:'100%', background:cg, borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:cg }}>{tauxGlobal}%</span>
                </> : <span style={{ fontSize:11, color:'#ddd' }}>—</span>}
              </div>
              <div style={{ textAlign:'center' }}>
                {m.solde > 0
                  ? <span style={{ fontSize:12, fontWeight:500, color:m.solde>3?'#E24B4A':'#b45309', background:m.solde>3?'#fef2f2':'#fff8e6', padding:'2px 7px', borderRadius:6 }}>{m.solde}</span>
                  : <span style={{ fontSize:11, color:'#ddd' }}>—</span>}
              </div>
            </div>
          )
        })}
        {membresFiltres.length === 0 && <p style={{ color:'#aaa', fontSize:13, textAlign:'center', padding:20 }}>Aucun membre pour ces critères</p>}
      </div>

      {/* ── MODALS ── */}
      {modal === 'membres_faibles' && (
        <ModalDetail titre={`Assiduité < 40% (${data.membresFaibles.length})`} onClose={() => setModal(null)}>
          {data.membresFaibles.sort((a,b)=>a.taux-b.taux).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#aaa' }}>{m.totalSuivis}/{m.totalSuivis+m.totalManques} cours</span>
              <span style={{ fontSize:14, fontWeight:500, color:'#E24B4A' }}>{m.taux}%</span>
            </div>
          ))}
          {data.membresFaibles.length === 0 && <p style={{ color:'#aaa' }}>Aucun membre sous 40% 🎉</p>}
        </ModalDetail>
      )}

      {modal === 'absents' && (
        <ModalDetail titre={`Absents depuis > 30 jours (${data.membresAbsents.length})`} onClose={() => setModal(null)}>
          {data.membresAbsents.sort((a,b)=>b.joursAbsent-a.joursAbsent).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#b45309' }}>Absent depuis {m.joursAbsent} jours</span>
            </div>
          ))}
        </ModalDetail>
      )}

      {modal === 'rattrapages' && (
        <ModalDetail titre="Cours à rattraper" onClose={() => setModal(null)}>
          {data.statsMembres.filter(m=>m.solde>0).sort((a,b)=>b.solde-a.solde).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#aaa' }}>{m.totalManques} manqués · {m.totalRattrapages} rattrapés</span>
              <span style={{ fontSize:14, fontWeight:500, color:m.solde>3?'#E24B4A':'#b45309' }}>{m.solde}</span>
            </div>
          ))}
        </ModalDetail>
      )}

      {modal === 'fin_saison' && (
        <ModalDetail titre="Fin de saison — renouvellements juin 2026" onClose={() => setModal(null)}>
          <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>{data.statsMembres.length} membres à contacter pour le renouvellement.</p>
          <button style={{ padding:'9px 16px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, marginBottom:16 }}
            onClick={() => {
              const csv = ['Nom,Email,Téléphone,Abonnement,Assiduité,À rattraper']
              data.statsMembres.forEach(m => {
                csv.push(`"${m.nom}","${m.email||''}","${m.telephone||''}","${m.abo?.type||m.abonnement||''}","${m.taux!==null?m.taux+'%':'—'}","${m.solde||0}"`)
              })
              const blob = new Blob([csv.join('\n')], {type:'text/csv;charset=utf-8;'})
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='renouvellements_juin_2026.csv'; a.click()
            }}>⬇ Exporter CSV</button>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 70px', gap:8, padding:'4px 0 8px', fontSize:11, color:'#aaa', fontWeight:500, borderBottom:'0.5px solid #f0f0f0' }}>
            <span>Membre</span><span style={{ textAlign:'center' }}>Abonnement</span><span style={{ textAlign:'center' }}>Assiduité</span>
          </div>
          {data.statsMembres.map(m => (
            <div key={m.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 70px', gap:8, padding:'7px 0', borderTop:'0.5px solid #f8f8f8', fontSize:13 }}>
              <span style={{ fontWeight:500 }}>{m.nom}</span>
              <span style={{ color:'#888', fontSize:12, textAlign:'center' }}>{m.abo?.type||m.abonnement?.split('·')[0]?.trim()?.substring(0,12)||'—'}</span>
              <span style={{ textAlign:'center', fontWeight:500, color:m.taux!==null?couleurTaux(m.taux):'#ccc' }}>{m.taux!==null?m.taux+'%':'—'}</span>
            </div>
          ))}
        </ModalDetail>
      )}
    </div>
  )
}
