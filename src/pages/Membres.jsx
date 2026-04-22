import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COULEURS = ['#FF0099','#8B4DB8','#1D9E75','#BA7517','#D85A30','#378ADD','#E24B4A','#0F6E56']
const JOURS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function initiales(nom) { return (nom||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }
function couleur(id) { let h=0; for(let c of (id||'')) h=(h*31+c.charCodeAt(0))%COULEURS.length; return COULEURS[h] }

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
  danger: { padding:'9px 18px', borderRadius:8, border:'1px solid #E24B4A', background:'transparent', color:'#E24B4A', cursor:'pointer', fontSize:14 },
}
const INPUT = { width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:14, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }

function Modal({ titre, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:520, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── FORMULAIRE MEMBRE ──────────────────────────────────────────
function FormMembre({ initial, tousLesCours, onSave, onClose }) {
  const [form, setForm] = useState(initial || { nom:'', telephone:'', email:'', notes:'' })
  const [inscriptions, setInscriptions] = useState([])
  const [abo, setAbo] = useState({ type:'Annuel', date_debut:'', date_fin:'', montant:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const setAboField = (k,v) => setAbo(a=>({...a,[k]:v}))

  useEffect(() => {
    if (initial?.id) {
      supabase.from('inscriptions').select('cours_id').eq('membre_id', initial.id)
        .then(({ data }) => setInscriptions((data||[]).map(i=>i.cours_id)))
      supabase.from('abonnements').select('*').eq('membre_id', initial.id).eq('saison','2025-2026').eq('statut','actif').maybeSingle()
        .then(({ data }) => { if (data) setAbo({ type:data.type, date_debut:data.date_debut||'', date_fin:data.date_fin||'', montant:data.montant||'' }) })
    }
  }, [initial?.id])

  function toggleCours(id) {
    setInscriptions(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const id = initial?.id || ('m' + Date.now().toString(36))
    const abonnement = tousLesCours.filter(c=>inscriptions.includes(c.id)).map(c=>c.nom).join(' · ')

    if (initial?.id) {
      await supabase.from('membres').update({ nom:form.nom, telephone:form.telephone, email:form.email, notes:form.notes, abonnement }).eq('id', initial.id)
      await supabase.from('inscriptions').delete().eq('membre_id', initial.id)
    } else {
      await supabase.from('membres').insert({ id, nom:form.nom, telephone:form.telephone, email:form.email, notes:form.notes, abonnement, actif:true })
    }
    if (inscriptions.length > 0) {
      await supabase.from('inscriptions').insert(inscriptions.map(cId=>({ cours_id:cId, membre_id:id })))
    }
    // Sauvegarder l'abonnement si renseigné
    if (abo.date_debut) {
      await supabase.from('abonnements').delete().eq('membre_id', id).eq('saison','2025-2026')
      await supabase.from('abonnements').insert({ membre_id:id, saison:'2025-2026', type:abo.type, date_debut:abo.date_debut, date_fin:abo.date_fin||null, montant:abo.montant||null, statut:'actif' })
    }
    setSaving(false)
    onSave()
  }

  const coursByJour = JOURS_FULL.map((j,i) => ({ jour:j, idx:i, cours:tousLesCours.filter(c=>c.jour===i) })).filter(g=>g.cours.length>0)
  const SAISON_DEBUT = '2025-09-01'
  const SAISON_FIN = '2026-07-31'
  const datesFin = { 'Annuel': SAISON_FIN, 'Semestriel': '2026-01-31', 'T1': '2025-12-31', 'T2': '2026-03-31', 'T3': SAISON_FIN, 'Seance': '' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Nom complet *</label>
        <input style={INPUT} value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder="Sophie Dupont" autoFocus />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Téléphone</label>
          <input style={INPUT} value={form.telephone||''} onChange={e=>set('telephone',e.target.value)} placeholder="06 …" /></div>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Email</label>
          <input style={INPUT} value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="@" /></div>
      </div>

      {/* Abonnement */}
      <div style={{ background:'#f8f8f8', borderRadius:10, padding:12 }}>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8, fontWeight:500 }}>Abonnement saison 2025/2026</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Type</label>
            <select style={{ ...INPUT }} value={abo.type} onChange={e => {
              const t = e.target.value
              setAboField('type', t)
              if (!abo.date_debut) setAboField('date_debut', SAISON_DEBUT)
              if (datesFin[t]) setAboField('date_fin', datesFin[t])
            }}>
              <option value="Annuel">Annuel</option>
              <option value="Semestriel">Semestriel</option>
              <option value="T1">Trimestre 1 (sept–déc)</option>
              <option value="T2">Trimestre 2 (janv–mars)</option>
              <option value="T3">Trimestre 3 (avr–juil)</option>
              <option value="Seance">À la séance</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Montant (€)</label>
            <input style={INPUT} type="number" value={abo.montant||''} onChange={e=>setAboField('montant',e.target.value)} placeholder="ex: 335" />
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Début</label>
            <input style={INPUT} type="date" value={abo.date_debut||''} onChange={e=>setAboField('date_debut',e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Fin</label>
            <input style={INPUT} type="date" value={abo.date_fin||''} onChange={e=>setAboField('date_fin',e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8 }}>Cours inscrits</label>
        {coursByJour.map(g => (
          <div key={g.jour} style={{ marginBottom:10 }}>
            <p style={{ fontSize:11, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{g.jour}</p>
            {g.cours.map(c => (
              <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: inscriptions.includes(c.id) ? 'rgba(255,0,153,0.05)' : '#f8f8f8', border:`1px solid ${inscriptions.includes(c.id)?'#FF0099':'transparent'}`, marginBottom:4, cursor:'pointer' }}>
                <input type="checkbox" checked={inscriptions.includes(c.id)} onChange={()=>toggleCours(c.id)} style={{ accentColor:'#FF0099', width:16, height:16, flexShrink:0 }} />
                <span style={{ fontSize:13, flex:1 }}>{c.nom}</span>
                <span style={{ fontSize:12, color:'#aaa' }}>{c.heure} · {c.coach}</span>
              </label>
            ))}
          </div>
        ))}
        {tousLesCours.length === 0 && <p style={{ fontSize:13, color:'#aaa' }}>Aucun cours configuré</p>}
      </div>

      <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Notes</label>
        <textarea style={{ ...INPUT, resize:'vertical' }} rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></div>

      <div style={{ display:'flex', gap:8, paddingTop:4 }}>
        <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer le membre'}
        </button>
      </div>
    </div>
  )
}

// ─── AFFICHAGE ABONNEMENT ───────────────────────────────────────
function AboInfo({ membreId }) {
  const [abo, setAbo] = useState(null)
  useEffect(() => {
    supabase.from('abonnements').select('*').eq('membre_id', membreId).eq('saison','2025-2026').eq('statut','actif').maybeSingle()
      .then(({ data }) => setAbo(data))
  }, [membreId])
  if (!abo) return null
  const debut = abo.date_debut ? new Date(abo.date_debut+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—'
  const fin = abo.date_fin ? new Date(abo.date_fin+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
      <span style={{ fontSize:12, fontWeight:500, padding:'3px 10px', borderRadius:8, background:'rgba(255,0,153,0.1)', color:'#FF0099' }}>{abo.type}</span>
      <span style={{ fontSize:12, color:'#888' }}>{debut} → {fin}</span>
      {abo.montant && <span style={{ fontSize:12, color:'#888' }}>· {Number(abo.montant).toLocaleString('fr-FR')} €</span>}
    </div>
  )
}

// ─── FICHE MEMBRE ───────────────────────────────────────────────
function FicheMembre({ membre, tousLesCours, onClose, onEdit, onArchiver }) {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [membre.id])

  async function loadStats() {
    let inscData, histoData

    if (!navigator.onLine) {
      // Utiliser les caches locaux
      try {
        const inscCache = JSON.parse(localStorage.getItem('happycath_inscriptions_cache') || '[]')
        inscData = inscCache.filter(i => i.membre_id === membre.id)
        histoData = JSON.parse(localStorage.getItem('happycath_histo_cache') || '[]')
      } catch(e) { inscData = []; histoData = [] }
    } else {
      // En ligne : charger depuis Supabase et mettre en cache
      const [{ data: iData }, { data: hData }] = await Promise.all([
        supabase.from('inscriptions').select('cours_id').eq('membre_id', membre.id),
        supabase.from('historique').select('*').order('date', { ascending: false })
      ])
      inscData = iData || []
      histoData = hData || []
      // Mettre à jour le cache historique complet
      try { localStorage.setItem('happycath_histo_cache', JSON.stringify(histoData)) } catch(e) {}
    }

    const courIds = (inscData||[]).map(i=>i.cours_id)
    const toutesLesSessions = []
    let totalSuivis = 0, totalManques = 0, totalRattrapages = 0, derniereDate = null

    const statsParCours = courIds.map(cId => {
      const cours = tousLesCours.find(c=>c.id===cId)
      const appels = (histoData||[]).filter(h=>h.cours_id===cId)
      let suivis=0, manques=0
      appels.forEach(h => {
        const estPresent = (h.presents||[]).includes(membre.id)
        const estRattrapage = (h.guests||[]).some(g=>g.membreId===membre.id&&g.type==='rattrapage')
        toutesLesSessions.push({ date:h.date, cours:cours?.nom||'?', coursId:cId, histoId:h.id, statut: estPresent?'present': estRattrapage?'rattrapage':'absent' })
        if (estPresent||estRattrapage) { suivis++; if(!derniereDate||h.date>derniereDate) derniereDate=h.date }
        else manques++
      })
      totalSuivis+=suivis; totalManques+=manques
      return { cours, suivis, manques, total:appels.length, taux: appels.length>0?Math.round(suivis/appels.length*100):0 }
    })

    ;(histoData||[]).forEach(h => {
      const isRattrapage = (h.guests||[]).some(g=>g.membreId===membre.id&&g.type==='rattrapage')
      if (isRattrapage && !courIds.includes(h.cours_id)) {
        const cours = tousLesCours.find(c=>c.id===h.cours_id)
        toutesLesSessions.push({ date:h.date, cours:cours?.nom||h.cours_nom||'?', coursId:h.cours_id, histoId:h.id, statut:'rattrapage' })
        totalRattrapages++; if(!derniereDate||h.date>derniereDate) derniereDate=h.date
      }
    })

    toutesLesSessions.sort((a,b)=>b.date.localeCompare(a.date))
    setStats({ statsParCours, totalSuivis, totalManques, totalRattrapages, derniereDate, solde: totalManques-totalRattrapages })
    setSessions(toutesLesSessions)
    setLoading(false)
  }

  const coul = couleur(membre.id)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <button onClick={onClose} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ width:52, height:52, borderRadius:'50%', background:coul+'20', color:coul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:500, flexShrink:0 }}>{initiales(membre.nom)}</div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>{membre.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{membre.abonnement||'Pas de cours'}</p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Modifier</button>
          <button onClick={onArchiver} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:16, padding:'6px 8px' }}>🗑</button>
        </div>
      </div>

      {/* Contact + Abonnement */}
      <div style={{ background:'#f8f8f8', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
        {(membre.telephone||membre.email) && (
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom: membre.abonnement?10:0 }}>
            {membre.telephone && <span style={{ fontSize:13 }}>📞 {membre.telephone}</span>}
            {membre.email && <span style={{ fontSize:13 }}>✉️ {membre.email}</span>}
          </div>
        )}
        {/* Abonnement depuis la table abonnements */}
        <AboInfo membreId={membre.id} />
      </div>

      {loading ? <p style={{ color:'#888', fontSize:14 }}>Calcul des statistiques…</p> : stats && <>
        {/* KPIs globaux */}
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Bilan global</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:16 }}>
          <div style={{ background:'rgba(255,0,153,0.06)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:500, color:'#FF0099', marginBottom:2 }}>{stats.totalSuivis}</div>
            <div style={{ fontSize:12, color:'#888' }}>Cours suivis</div>
          </div>
          <div style={{ background:'#f8f8f8', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:500, marginBottom:2 }}>{stats.totalManques}</div>
            <div style={{ fontSize:12, color:'#888' }}>Cours manqués</div>
          </div>
          <div style={{ background:'rgba(204,255,0,0.1)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:500, color:'#3a5000', marginBottom:2 }}>{stats.totalRattrapages}</div>
            <div style={{ fontSize:12, color:'#888' }}>Rattrapages</div>
          </div>
          <div style={{ background: stats.solde > 0 ? '#fff8e6' : 'rgba(29,158,117,0.08)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:500, color: stats.solde>0?'#b45309':'#0f6e56', marginBottom:2 }}>{stats.solde > 0 ? '+'+stats.solde : stats.solde}</div>
            <div style={{ fontSize:12, color:'#888' }}>Restant à rattraper</div>
          </div>
        </div>
        {stats.derniereDate && <p style={{ fontSize:12, color:'#aaa', marginBottom:16 }}>Dernier cours : {new Date(stats.derniereDate+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>}

        {/* Assiduité par cours */}
        {stats.statsParCours.length > 0 && <>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Assiduité par cours</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {stats.statsParCours.map(s => (
              <div key={s.cours?.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#FF0099', flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{s.cours?.nom||'?'}</span>
                  <span style={{ fontSize:12, color: s.taux>=80?'#0f6e56':s.taux>=50?'#b45309':'#E24B4A', fontWeight:500 }}>{s.taux}%</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'#888' }}>
                  <span style={{ color:'#FF0099' }}>{s.suivis} suivis</span>
                  <span>{s.manques} manqués</span>
                  <span>sur {s.total} séances</span>
                </div>
                {/* Barre de présence */}
                <div style={{ height:4, background:'#f0f0f0', borderRadius:2, marginTop:8, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.taux}%`, background: s.taux>=80?'#1D9E75':s.taux>=50?'#BA7517':'#E24B4A', borderRadius:2, transition:'width .3s' }} />
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Historique sessions */}
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Toutes les sessions</p>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {sessions.slice(0,30).map((s,i) => {
            const dateStr = new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
            const colors = { present:{ bg:'rgba(255,0,153,0.07)', color:'#FF0099', label:'Présent' }, rattrapage:{ bg:'rgba(204,255,0,0.1)', color:'#3a5000', label:'Rattrapage' }, absent:{ bg:'#f8f8f8', color:'#aaa', label:'Absent' } }
            const style = colors[s.statut]
            return (
              <div key={i} style={{ background:style.bg, borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:12, color:'#888', minWidth:48 }}>{dateStr}</span>
                <span style={{ fontSize:13, flex:1 }}>{s.cours}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:style.bg, color:style.color, border:`1px solid ${style.color}20`, fontWeight:500 }}>{style.label}</span>
              </div>
            )
          })}
          {sessions.length === 0 && <p style={{ fontSize:13, color:'#aaa', textAlign:'center', padding:16 }}>Aucune session enregistrée</p>}
        </div>
      </>}

      {membre.notes && <>
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:'16px 0 8px' }}>Notes</p>
        <p style={{ fontSize:13, color:'#555', background:'#f8f8f8', borderRadius:8, padding:'10px 12px' }}>{membre.notes}</p>
      </>}
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────
export default function Membres() {
  const [membres, setMembres] = useState([])
  const [tousLesCours, setTousLesCours] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vue, setVue] = useState('liste') // 'liste' | 'fiche'
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nouveau' | {membre à éditer}
  const [toast, setToast] = useState(null)

  const MEMBRES_CACHE = 'happycath_membres_cache'

  const loadData = useCallback(async () => {
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem(MEMBRES_CACHE) || 'null')
        if (cached) {
          setMembres(cached.membres || [])
          setTousLesCours(cached.cours || [])
          setLoading(false)
          return
        }
      } catch(e) {}
      setLoading(false)
      return
    }
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from('membres').select('*').eq('actif', true).order('nom'),
      supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure')
    ])

    // Pré-charger inscriptions + historique pour le mode hors ligne
    const [{ data: inscriptions }, { data: historique }] = await Promise.all([
      supabase.from('inscriptions').select('cours_id, membre_id'),
      supabase.from('historique').select('*').order('date', { ascending: false })
    ])

    try {
      localStorage.setItem(MEMBRES_CACHE, JSON.stringify({ membres: m||[], cours: c||[], timestamp: Date.now() }))
      localStorage.setItem('happycath_inscriptions_cache', JSON.stringify(inscriptions || []))
      localStorage.setItem('happycath_histo_cache', JSON.stringify(historique || []))
    } catch(e) {}
    setMembres(m||[])
    setTousLesCours(c||[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    if (!navigator.onLine) return
    const sub = supabase.channel('membres_ch')
      .on('postgres_changes', { event:'*', schema:'public', table:'membres' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [loadData])

  async function archiver(membre) {
    if (!window.confirm(`Archiver ${membre.nom} ?`)) return
    await supabase.from('membres').update({ actif:false }).eq('id', membre.id)
    showToast('Membre archivé')
    setVue('liste'); setSelected(null)
    loadData()
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const filtered = membres.filter(m => {
    const s = search.toLowerCase()
    return !s || m.nom.toLowerCase().includes(s) || (m.abonnement||'').toLowerCase().includes(s)
  })

  if (vue === 'fiche' && selected) {
    return (
      <div>
        <FicheMembre
          membre={selected}
          tousLesCours={tousLesCours}
          onClose={() => { setVue('liste'); setSelected(null) }}
          onEdit={() => setModal(selected)}
          onArchiver={() => archiver(selected)}
        />
        {modal && (
          <Modal titre={`Modifier — ${modal.nom}`} onClose={() => setModal(null)}>
            <FormMembre initial={modal} tousLesCours={tousLesCours}
              onSave={() => { setModal(null); loadData(); showToast('Membre modifié !'); const updated = membres.find(m=>m.id===modal.id); if(updated) setSelected({...updated}) }}
              onClose={() => setModal(null)} />
          </Modal>
        )}
        {toast && <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>✓ {toast}</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Membres</h1>
        <button style={BTN.primary} onClick={() => setModal('nouveau')}>+ Nouveau membre</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-val" style={{ color:'#FF0099' }}>{membres.length}</div><div className="stat-lbl">Membres actifs</div></div>
        <div className="stat-card"><div className="stat-val">{tousLesCours.length}</div><div className="stat-lbl">Cours</div></div>
        <div className="stat-card"><div className="stat-val">{membres.filter(m=>m.abonnement).length}</div><div className="stat-lbl">Avec abonnement</div></div>
      </div>

      <input type="text" placeholder="Rechercher un membre…" value={search} onChange={e=>setSearch(e.target.value)}
        style={{ ...INPUT, marginBottom:12 }} />

      {loading ? <p style={{ color:'#888', fontSize:14 }}>Chargement…</p> : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px', gap:8, padding:'0 14px 6px', fontSize:11, color:'#aaa', fontWeight:500 }}>
            <span>Membre</span>
            <span style={{ textAlign:'center' }}>Assiduité</span>
            <span style={{ textAlign:'center' }}>Rattrap.</span>
          </div>
          {filtered.map(m => {
            const coul = couleur(m.id)
            // Taux depuis le cache si disponible
            let taux = null, solde = 0
            try {
              const statsCache = JSON.parse(localStorage.getItem('happycath_dashboard_cache') || 'null')
              if (statsCache) {
                const stat = statsCache.statsMembres?.find(s => s.id === m.id)
                if (stat) { taux = stat.taux; solde = stat.solde || 0 }
              }
            } catch(e) {}
            const tauxColor = taux !== null ? (taux >= 80 ? '#0f6e56' : taux >= 60 ? '#BA7517' : '#E24B4A') : '#ccc'
            return (
              <div key={m.id} onClick={() => { setSelected(m); setVue('fiche') }}
                style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'10px 14px', display:'grid', gridTemplateColumns:'1fr 80px 60px', gap:8, alignItems:'center', cursor:'pointer', transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#FF0099'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.08)'}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:coul+'20', color:coul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, flexShrink:0 }}>{initiales(m.nom)}</div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:500, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.nom}</p>
                    <p style={{ fontSize:11, color:'#aaa', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.abonnement||'Aucun cours'}</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                  {taux !== null ? <>
                    <div style={{ width:28, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ width:`${taux}%`, height:'100%', background:tauxColor, borderRadius:2 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:500, color:tauxColor }}>{taux}%</span>
                  </> : <span style={{ fontSize:11, color:'#ddd' }}>—</span>}
                </div>
                <div style={{ textAlign:'center' }}>
                  {solde > 0
                    ? <span style={{ fontSize:12, fontWeight:500, color: solde>3?'#E24B4A':'#b45309', background: solde>3?'#fef2f2':'#fff8e6', padding:'2px 7px', borderRadius:6 }}>{solde}</span>
                    : <span style={{ fontSize:11, color:'#ddd' }}>—</span>}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p style={{ color:'#aaa', fontSize:14, textAlign:'center', padding:24 }}>Aucun membre trouvé</p>}
        </div>
      )}

      {modal && (
        <Modal titre={modal==='nouveau' ? 'Nouveau membre' : `Modifier — ${modal.nom}`} onClose={()=>setModal(null)}>
          <FormMembre
            initial={modal==='nouveau' ? null : modal}
            tousLesCours={tousLesCours}
            onSave={() => { setModal(null); loadData(); showToast(modal==='nouveau'?'Membre créé !':'Membre modifié !') }}
            onClose={()=>setModal(null)} />
        </Modal>
      )}

      {toast && <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>✓ {toast}</div>}
    </div>
  )
}
