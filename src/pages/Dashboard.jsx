import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
}

function couleurTaux(t) {
  if (t >= 80) return '#0f6e56'
  if (t >= 60) return '#BA7517'
  return '#E24B4A'
}

function labelTaux(t) {
  if (t >= 85) return { label: 'Plein', bg: 'rgba(29,158,117,0.12)', color: '#0f6e56' }
  if (t >= 70) return { label: 'Fort', bg: 'rgba(29,158,117,0.08)', color: '#0f6e56' }
  if (t >= 50) return { label: 'Moyen', bg: '#fff8e6', color: '#b45309' }
  return { label: 'Faible', bg: '#fef2f2', color: '#E24B4A' }
}

// ─── MODAL DÉTAIL KPI ───────────────────────────────────────────
function ModalDetail({ titre, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:600, maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:17, fontWeight:500, margin:0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── CARTE KPI CLIQUABLE ────────────────────────────────────────
function KpiCard({ val, lbl, color, delta, deltaColor, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'14px 16px', cursor: onClick ? 'pointer' : 'default', transition:'border-color .15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor='#FF0099')}
      onMouseLeave={e => e.currentTarget.style.borderColor='rgba(0,0,0,0.08)'}>
      <div style={{ fontSize:28, fontWeight:500, color: color||'#1a1a1a', marginBottom:2 }}>{val}</div>
      <div style={{ fontSize:12, color:'#888' }}>{lbl}</div>
      {delta && <div style={{ fontSize:11, color: deltaColor||'#888', marginTop:4 }}>{delta}</div>}
      {onClick && <div style={{ fontSize:10, color:'#FF0099', marginTop:4 }}>Voir le détail →</div>}
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'membres_faibles' | 'absents' | 'cours_forts' | 'rattrapages' | 'fin_saison'
  const [periode, setPeriode] = useState('saison')

  const CACHE_KEY = 'happycath_dashboard_cache'

  const loadDashboard = useCallback(async () => {
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached) { setData(cached); setLoading(false); return }
      } catch(e) {}
      setLoading(false); return
    }

    const [
      { data: membres },
      { data: cours },
      { data: inscriptions },
      { data: historique },
      { data: abonnements }
    ] = await Promise.all([
      supabase.from('membres').select('*').eq('actif', true).order('nom'),
      supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure'),
      supabase.from('inscriptions').select('*'),
      supabase.from('historique').select('*').order('date', { ascending: false }),
      supabase.from('abonnements').select('*').eq('saison', '2025-2026')
    ])

    const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

    // Stats par cours
    const statsCours = (cours || []).map(c => {
      const inscrits = (inscriptions || []).filter(i => i.cours_id === c.id)
      const appels = (historique || []).filter(h => h.cours_id === c.id)
      let totalPresences = 0, totalPossible = 0
      appels.forEach(h => {
        const nb = (h.presents || []).length + (h.guests || []).filter(g => g.type === 'rattrapage').length
        totalPresences += nb
        totalPossible += inscrits.length
      })
      const taux = totalPossible > 0 ? Math.round(totalPresences / totalPossible * 100) : 0
      const capacite = c.capacite_max || 15
      const tauxRemplissage = Math.round(inscrits.length / capacite * 100)
      return {
        ...c,
        nb_inscrits: inscrits.length,
        nb_appels: appels.length,
        taux_assiduite: taux,
        taux_remplissage: tauxRemplissage,
        capacite_max: capacite,
        label: `${JOURS[c.jour]} ${c.heure}`
      }
    }).sort((a,b) => b.taux_assiduite - a.taux_assiduite)

    // Stats par membre
    const statsMembres = (membres || []).map(m => {
      const inscMembre = (inscriptions || []).filter(i => i.membre_id === m.id)
      const courIds = inscMembre.map(i => i.cours_id)

      // Trouver la période active selon abonnement
      const aboActif = (abonnements || []).find(a => a.membre_id === m.id && a.statut === 'actif')

      let totalSuivis = 0, totalPossible = 0, totalManques = 0, totalRattrapages = 0

      courIds.forEach(cId => {
        const appels = (historique || []).filter(h => {
          if (h.cours_id !== cId) return false
          if (aboActif) {
            return h.date >= aboActif.date_debut && h.date <= aboActif.date_fin
          }
          return true
        })
        appels.forEach(h => {
          const estPresent = (h.presents || []).includes(m.id)
          const estRattrapage = (h.guests || []).some(g => g.membreId === m.id && g.type === 'rattrapage')
          totalPossible++
          if (estPresent || estRattrapage) totalSuivis++
          else totalManques++
          if (estRattrapage) totalRattrapages++
        })
      })

      // Rattrapages dans autres cours
      ;(historique || []).forEach(h => {
        if (courIds.includes(h.cours_id)) return
        const isRattrapage = (h.guests || []).some(g => g.membreId === m.id && g.type === 'rattrapage')
        if (isRattrapage) totalRattrapages++
      })

      const taux = totalPossible > 0 ? Math.round(totalSuivis / totalPossible * 100) : null
      const solde = Math.max(0, totalManques - totalRattrapages)
      const dernierCours = (historique || []).find(h => (h.presents||[]).includes(m.id) || (h.guests||[]).some(g=>g.membreId===m.id))
      const joursAbsent = dernierCours ? Math.floor((Date.now() - new Date(dernierCours.date+'T12:00:00').getTime()) / 86400000) : 999
      const abo = (abonnements || []).find(a => a.membre_id === m.id && a.statut === 'actif')

      return { ...m, taux, solde, totalSuivis, totalManques, totalRattrapages, joursAbsent, abo }
    })

    // KPIs globaux
    const tauxMoyen = statsMembres.filter(m => m.taux !== null).reduce((s, m) => s + m.taux, 0) / Math.max(1, statsMembres.filter(m => m.taux !== null).length)
    const membresFaibles = statsMembres.filter(m => m.taux !== null && m.taux < 40)
    const membresAbsents = statsMembres.filter(m => m.joursAbsent > 30 && m.joursAbsent < 900)
    const totalRattrapages = statsMembres.reduce((s, m) => s + m.solde, 0)
    const coursForts = statsCours.filter(c => c.taux_assiduite >= 80)

    // Répartition par catégorie (basée sur le champ abonnement)
    const categories = {}
    ;(membres || []).forEach(m => {
      const cats = (m.abonnement || '').split('·').map(s => s.trim()).filter(Boolean)
      cats.forEach(cat => { categories[cat] = (categories[cat] || 0) + 1 })
    })

    const result = {
      nbMembres: membres?.length || 0,
      nbCours: cours?.length || 0,
      tauxMoyen: Math.round(tauxMoyen),
      totalRattrapages,
      statsCours,
      statsMembres,
      membresFaibles,
      membresAbsents,
      coursForts,
      categories,
      timestamp: Date.now()
    }

    try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)) } catch(e) {}
    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  if (loading) return <div style={{ padding:20, color:'#888' }}>Calcul des statistiques…</div>
  if (!data) return <div style={{ padding:20, color:'#888' }}>Impossible de charger les données</div>

  const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p style={{ fontSize:13, color:'#888', marginTop:2 }}>Saison 2025/2026</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setModal('fin_saison')} style={{ ...BTN.ghost, fontSize:13, padding:'7px 14px' }}>Fin de saison</button>
          <button onClick={loadDashboard} style={{ ...BTN.ghost, fontSize:13, padding:'7px 14px' }}>↻ Actualiser</button>
        </div>
      </div>

      {/* KPIs */}
      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Chiffres clés</p>
      <div className="stats-grid" style={{ marginBottom:20 }}>
        <KpiCard val={data.nbMembres} lbl="Membres actifs" color="#FF0099" />
        <KpiCard val={data.nbCours} lbl="Cours / semaine" />
        <KpiCard
          val={`${data.tauxMoyen}%`} lbl="Assiduité moyenne"
          color={couleurTaux(data.tauxMoyen)}
          onClick={() => setModal('membres_faibles')} />
        <KpiCard
          val={data.totalRattrapages} lbl="Cours à rattraper"
          color={data.totalRattrapages > 50 ? '#b45309' : '#1a1a1a'}
          onClick={() => setModal('rattrapages')} />
      </div>

      {/* Alertes */}
      {(data.membresFaibles.length > 0 || data.membresAbsents.length > 0) && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
          {data.membresFaibles.length > 0 && (
            <div onClick={() => setModal('membres_faibles')} style={{ background:'#fef2f2', border:'0.5px solid #fca5a5', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <span style={{ fontSize:13, color:'#E24B4A', flex:1 }}>⚠ {data.membresFaibles.length} membre{data.membresFaibles.length>1?'s':''} avec assiduité &lt; 40%</span>
              <span style={{ fontSize:11, color:'#E24B4A' }}>Voir →</span>
            </div>
          )}
          {data.membresAbsents.length > 0 && (
            <div onClick={() => setModal('absents')} style={{ background:'#fff8e6', border:'0.5px solid #fcd34d', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <span style={{ fontSize:13, color:'#b45309', flex:1 }}>⏰ {data.membresAbsents.length} membre{data.membresAbsents.length>1?'s':''} absent{data.membresAbsents.length>1?'s':''} depuis plus de 30 jours</span>
              <span style={{ fontSize:11, color:'#b45309' }}>Voir →</span>
            </div>
          )}
          {data.coursForts.length > 0 && (
            <div onClick={() => setModal('cours_forts')} style={{ background:'rgba(29,158,117,0.08)', border:'0.5px solid #6ee7b7', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <span style={{ fontSize:13, color:'#0f6e56', flex:1 }}>🎯 {data.coursForts.length} cours avec assiduité &gt; 80% — excellente performance !</span>
              <span style={{ fontSize:11, color:'#0f6e56' }}>Voir →</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12, marginBottom:12 }}>
        {/* Performance cours */}
        <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:16 }}>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Performance des cours</p>
          {data.statsCours.slice(0, 7).map(c => {
            const tag = labelTaux(c.taux_assiduite)
            const remplissage = c.taux_remplissage
            return (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderTop:'0.5px solid #f5f5f5' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:500, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nom}</p>
                  <p style={{ fontSize:11, color:'#aaa', margin:0 }}>{JOURS[c.jour]} {c.heure} · {c.nb_inscrits}/{c.capacite_max} inscrits</p>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <div style={{ width:50, height:5, background:'#f0f0f0', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${c.taux_assiduite}%`, height:'100%', background:couleurTaux(c.taux_assiduite), borderRadius:3 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:500, color:couleurTaux(c.taux_assiduite), minWidth:30 }}>{c.taux_assiduite}%</span>
                  </div>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:6, background:tag.bg, color:tag.color }}>{tag.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Remplissage des cours */}
        <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:16 }}>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Taux de remplissage</p>
          {data.statsCours.slice(0, 7).map(c => {
            const pct = Math.min(100, c.taux_remplissage)
            const color = pct >= 80 ? '#FF0099' : pct >= 60 ? '#BA7517' : '#E24B4A'
            return (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderTop:'0.5px solid #f5f5f5' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:500, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nom}</p>
                  <p style={{ fontSize:11, color:'#aaa', margin:0 }}>{c.nb_inscrits} / {c.capacite_max} places</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <div style={{ width:60, height:8, background:'#f0f0f0', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color, minWidth:30 }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste membres avec taux */}
      <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:0 }}>Membres — présence & rattrapages</p>
          <div style={{ display:'flex', gap:6 }}>
            {['tous','faibles','rattrapages','absents'].map(f => (
              <button key={f} onClick={() => setPeriode(f)}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:12, border:`0.5px solid ${periode===f?'#FF0099':'rgba(0,0,0,0.15)'}`, background:periode===f?'#FF0099':'transparent', color:periode===f?'#fff':'#666', cursor:'pointer' }}>
                {f==='tous'?'Tous':f==='faibles'?'< 40%':f==='rattrapages'?'À rattraper':'Absents'}
              </button>
            ))}
          </div>
        </div>

        {/* Header tableau */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0 8px', fontSize:11, color:'#aaa', fontWeight:500 }}>
          <span style={{ flex:1 }}>Membre</span>
          <span style={{ minWidth:120, fontSize:11 }}>Abonnement</span>
          <span style={{ minWidth:80, textAlign:'center' }}>Présence</span>
          <span style={{ minWidth:60, textAlign:'center' }}>À rattraper</span>
        </div>

        {data.statsMembres
          .filter(m => {
            if (periode === 'faibles') return m.taux !== null && m.taux < 40
            if (periode === 'rattrapages') return m.solde > 0
            if (periode === 'absents') return m.joursAbsent > 30 && m.joursAbsent < 900
            return true
          })
          .slice(0, 20)
          .map(m => {
            const c = m.taux !== null ? couleurTaux(m.taux) : '#ccc'
            return (
              <div key={m.id} onClick={() => navigate('/membres')}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'0.5px solid #f5f5f5', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ flex:1, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.nom}</span>
                <span style={{ minWidth:120, fontSize:11, color:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {m.abo ? `${m.abo.type} · exp. ${new Date(m.abo.date_fin+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}` : m.abonnement || '—'}
                </span>
                <div style={{ minWidth:80, display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                  {m.taux !== null ? <>
                    <div style={{ width:40, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ width:`${m.taux}%`, height:'100%', background:c, borderRadius:2 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:500, color:c }}>{m.taux}%</span>
                  </> : <span style={{ fontSize:12, color:'#ccc' }}>—</span>}
                </div>
                <span style={{ minWidth:60, textAlign:'center', fontSize:13, fontWeight: m.solde>0?'500':'400', color: m.solde>3?'#E24B4A':m.solde>0?'#b45309':'#ccc' }}>
                  {m.solde > 0 ? m.solde : '—'}
                </span>
              </div>
            )
          })}
        {data.statsMembres.length > 20 && <p style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'10px 0' }}>… {data.statsMembres.length - 20} autres membres</p>}
      </div>

      {/* ── MODALS ── */}

      {modal === 'membres_faibles' && (
        <ModalDetail titre={`Membres avec assiduité < 40% (${data.membresFaibles.length})`} onClose={() => setModal(null)}>
          {data.membresFaibles.sort((a,b)=>a.taux-b.taux).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#aaa' }}>{m.abonnement||'—'}</span>
              <span style={{ fontSize:13, fontWeight:500, color:'#E24B4A' }}>{m.taux}%</span>
              <span style={{ fontSize:11, color:'#aaa' }}>{m.totalSuivis}/{m.totalSuivis+m.totalManques} cours</span>
            </div>
          ))}
          {data.membresFaibles.length === 0 && <p style={{ color:'#aaa', fontSize:14 }}>Aucun membre sous 40% 🎉</p>}
        </ModalDetail>
      )}

      {modal === 'absents' && (
        <ModalDetail titre={`Membres absents depuis > 30 jours (${data.membresAbsents.length})`} onClose={() => setModal(null)}>
          {data.membresAbsents.sort((a,b)=>b.joursAbsent-a.joursAbsent).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#aaa' }}>{m.abonnement||'—'}</span>
              <span style={{ fontSize:12, color:'#b45309' }}>Absent depuis {m.joursAbsent} jours</span>
            </div>
          ))}
        </ModalDetail>
      )}

      {modal === 'rattrapages' && (
        <ModalDetail titre={`Cours à rattraper — détail membres`} onClose={() => setModal(null)}>
          {data.statsMembres.filter(m=>m.solde>0).sort((a,b)=>b.solde-a.solde).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:12, color:'#aaa' }}>{m.totalManques} manqués · {m.totalRattrapages} rattrapés</span>
              <span style={{ fontSize:14, fontWeight:500, color: m.solde>3?'#E24B4A':'#b45309' }}>{m.solde} à rattraper</span>
            </div>
          ))}
        </ModalDetail>
      )}

      {modal === 'cours_forts' && (
        <ModalDetail titre="Cours performants" onClose={() => setModal(null)}>
          {data.statsCours.filter(c=>c.taux_assiduite>=80).map(c => (
            <div key={c.id} style={{ padding:'10px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{c.nom}</span>
                <span style={{ fontSize:14, fontWeight:500, color:'#0f6e56' }}>{c.taux_assiduite}%</span>
              </div>
              <p style={{ fontSize:12, color:'#aaa', margin:0 }}>{JOURS[c.jour]} {c.heure} · {c.coach} · {c.nb_inscrits}/{c.capacite_max} inscrits</p>
            </div>
          ))}
        </ModalDetail>
      )}

      {modal === 'fin_saison' && (
        <ModalDetail titre="Fin de saison — juin 2026" onClose={() => setModal(null)}>
          <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>Liste des membres à contacter pour le renouvellement.</p>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <button style={{ ...BTN.primary, fontSize:13, padding:'8px 14px' }} onClick={() => {
              const csv = ['Nom,Email,Téléphone,Abonnement,Assiduité,À rattraper']
              data.statsMembres.forEach(m => {
                csv.push(`"${m.nom}","${m.email||''}","${m.telephone||''}","${m.abo?.type||m.abonnement||''}","${m.taux!==null?m.taux+'%':'—'}","${m.solde||0}"`)
              })
              const blob = new Blob([csv.join('\n')], {type:'text/csv;charset=utf-8;'})
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='renouvellements_juin_2026.csv'; a.click()
            }}>⬇ Exporter CSV</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0 8px', fontSize:11, color:'#aaa', fontWeight:500, borderBottom:'0.5px solid #f0f0f0' }}>
            <span style={{ flex:1 }}>Membre</span>
            <span style={{ minWidth:100 }}>Abonnement</span>
            <span style={{ minWidth:60, textAlign:'center' }}>Assiduité</span>
          </div>
          {data.statsMembres.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'0.5px solid #f5f5f5', fontSize:13 }}>
              <span style={{ flex:1, fontWeight:500 }}>{m.nom}</span>
              <span style={{ minWidth:100, color:'#888', fontSize:12 }}>{m.abo?.type || m.abonnement || '—'}</span>
              <span style={{ minWidth:60, textAlign:'center', fontWeight:500, color: m.taux!==null?couleurTaux(m.taux):'#ccc' }}>{m.taux!==null?m.taux+'%':'—'}</span>
            </div>
          ))}
        </ModalDetail>
      )}
    </div>
  )
}
