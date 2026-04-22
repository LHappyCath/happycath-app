import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useData } from '../lib/store'

const COULEURS = ['#FF0099','#8B4DB8','#1D9E75','#BA7517','#D85A30','#378ADD','#E24B4A','#0F6E56']
const JOURS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function initiales(nom) { return (nom||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }
function couleur(id) { let h=0; for(let c of (id||'')) h=(h*31+c.charCodeAt(0))%COULEURS.length; return COULEURS[h] }

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
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

// ─── ABONNEMENT INFO ────────────────────────────────────────────
function AboInfo({ membreId }) {
  const { abonnements } = useData()
  const abo = abonnements.find(a=>a.membre_id===membreId&&a.saison==='2025-2026'&&a.statut==='actif')
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

// ─── FORMULAIRE MEMBRE ──────────────────────────────────────────
function FormMembre({ initial, onSave, onClose }) {
  const { cours, inscriptions, sauvegarderMembre, sauvegarderInscriptions, sauvegarderAbonnement, abonnements } = useData()
  const [form, setForm] = useState(initial || { nom:'', telephone:'', email:'', notes:'' })
  const [inscrits, setInscrits] = useState(
    initial ? inscriptions.filter(i=>i.membre_id===initial.id).map(i=>i.cours_id) : []
  )
  const [abo, setAbo] = useState({ type:'Annuel', date_debut:'', date_fin:'', montant:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (initial?.id) {
      const aboActif = abonnements.find(a=>a.membre_id===initial.id&&a.saison==='2025-2026'&&a.statut==='actif')
      if (aboActif) setAbo({ type:aboActif.type, date_debut:aboActif.date_debut||'', date_fin:aboActif.date_fin||'', montant:aboActif.montant||'' })
    }
  }, [initial?.id, abonnements])

  const datesFin = { 'Annuel':'2026-07-31','Semestriel':'2026-01-31','T1':'2025-12-31','T2':'2026-03-31','T3':'2026-07-31','Seance':'' }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const id = initial?.id || ('m'+Date.now().toString(36))
    const abonnement = cours.filter(c=>inscrits.includes(c.id)).map(c=>c.nom).join(' · ')
    await sauvegarderMembre({ id, ...form, abonnement })
    await sauvegarderInscriptions(id, inscrits)
    if (abo.date_debut) await sauvegarderAbonnement(id, abo)
    setSaving(false)
    onSave()
  }

  const coursByJour = JOURS_FULL.map((j,i)=>({jour:j,idx:i,cours:cours.filter(c=>c.jour===i)})).filter(g=>g.cours.length>0)

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

      <div style={{ background:'#f8f8f8', borderRadius:10, padding:12 }}>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8, fontWeight:500 }}>Abonnement 2025/2026</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Type</label>
            <select style={INPUT} value={abo.type} onChange={e=>{const t=e.target.value;setAbo(a=>({...a,type:t,date_debut:a.date_debut||'2025-09-01',date_fin:datesFin[t]||a.date_fin}))}}>
              <option value="Annuel">Annuel</option>
              <option value="Semestriel">Semestriel</option>
              <option value="T1">Trimestre 1 (sept–déc)</option>
              <option value="T2">Trimestre 2 (janv–mars)</option>
              <option value="T3">Trimestre 3 (avr–juil)</option>
              <option value="Seance">À la séance</option>
            </select></div>
          <div><label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Montant (€)</label>
            <input style={INPUT} type="number" value={abo.montant||''} onChange={e=>setAbo(a=>({...a,montant:e.target.value}))} placeholder="335" /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Début</label>
            <input style={INPUT} type="date" value={abo.date_debut||''} onChange={e=>setAbo(a=>({...a,date_debut:e.target.value}))} /></div>
          <div><label style={{ fontSize:11, color:'#aaa', display:'block', marginBottom:4 }}>Fin</label>
            <input style={INPUT} type="date" value={abo.date_fin||''} onChange={e=>setAbo(a=>({...a,date_fin:e.target.value}))} /></div>
        </div>
      </div>

      <div>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8 }}>Cours inscrits</label>
        {coursByJour.map(g => (
          <div key={g.jour} style={{ marginBottom:10 }}>
            <p style={{ fontSize:11, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{g.jour}</p>
            {g.cours.map(c => (
              <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:inscrits.includes(c.id)?'rgba(255,0,153,0.05)':'#f8f8f8', border:`1px solid ${inscrits.includes(c.id)?'#FF0099':'transparent'}`, marginBottom:4, cursor:'pointer' }}>
                <input type="checkbox" checked={inscrits.includes(c.id)} onChange={()=>setInscrits(prev=>prev.includes(c.id)?prev.filter(x=>x!==c.id):[...prev,c.id])} style={{ accentColor:'#FF0099', width:16, height:16, flexShrink:0 }} />
                <span style={{ fontSize:13, flex:1 }}>{c.nom}</span>
                <span style={{ fontSize:12, color:'#aaa' }}>{c.heure} · {c.coach}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Notes</label>
        <textarea style={{ ...INPUT, resize:'vertical' }} rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></div>

      <div style={{ display:'flex', gap:8, paddingTop:4 }}>
        <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} onClick={save} disabled={saving}>
          {saving?'Enregistrement…':initial?'Modifier':'Créer le membre'}
        </button>
      </div>
    </div>
  )
}

// ─── FICHE MEMBRE ───────────────────────────────────────────────
function FicheMembre({ membre, onClose, onEdit, onArchiver }) {
  const { cours, inscriptions, historique, online } = useData()
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    const courIds = inscriptions.filter(i=>i.membre_id===membre.id).map(i=>i.cours_id)
    const toutesLesSessions = []
    let totalSuivis=0, totalManques=0, totalRattrapages=0, derniereDate=null

    const statsParCours = courIds.map(cId => {
      const c = cours.find(x=>x.id===cId)
      const appels = historique.filter(h=>h.cours_id===cId)
      let suivis=0, manques=0
      appels.forEach(h => {
        const estPresent = (h.presents||[]).includes(membre.id)
        const estRattrapage = (h.guests||[]).some(g=>g.membreId===membre.id&&g.type==='rattrapage')
        toutesLesSessions.push({ date:h.date, cours:c?.nom||'?', statut:estPresent?'present':estRattrapage?'rattrapage':'absent' })
        if (estPresent||estRattrapage){suivis++;if(!derniereDate||h.date>derniereDate)derniereDate=h.date}
        else manques++
      })
      totalSuivis+=suivis; totalManques+=manques
      return { cours:c, suivis, manques, total:appels.length, taux:appels.length>0?Math.round(suivis/appels.length*100):0 }
    })

    historique.forEach(h => {
      if (courIds.includes(h.cours_id)) return
      const isRattrapage = (h.guests||[]).some(g=>g.membreId===membre.id&&g.type==='rattrapage')
      if (isRattrapage) {
        const c = cours.find(x=>x.id===h.cours_id)
        toutesLesSessions.push({ date:h.date, cours:c?.nom||h.cours_nom||'?', statut:'rattrapage' })
        totalRattrapages++
        if(!derniereDate||h.date>derniereDate) derniereDate=h.date
      }
    })

    toutesLesSessions.sort((a,b)=>b.date.localeCompare(a.date))
    setStats({ statsParCours, totalSuivis, totalManques, totalRattrapages, derniereDate, solde:Math.max(0,totalManques-totalRattrapages) })
    setSessions(toutesLesSessions)
  }, [membre.id, cours, inscriptions, historique])

  const coul = couleur(membre.id)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <button onClick={onClose} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ width:52, height:52, borderRadius:'50%', background:coul+'20', color:coul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:500, flexShrink:0 }}>{initiales(membre.nom)}</div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>{membre.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{membre.abonnement||'Pas de cours'}</p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Modifier</button>
          {online && <button onClick={onArchiver} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:16, padding:'6px 8px' }}>🗑</button>}
        </div>
      </div>

      <div style={{ background:'#f8f8f8', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
        {(membre.telephone||membre.email) && (
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:8 }}>
            {membre.telephone && <span style={{ fontSize:13 }}>📞 {membre.telephone}</span>}
            {membre.email && <span style={{ fontSize:13 }}>✉️ {membre.email}</span>}
          </div>
        )}
        <AboInfo membreId={membre.id} />
      </div>

      {stats && <>
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
          <div style={{ background:stats.solde>0?'#fff8e6':'rgba(29,158,117,0.08)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:500, color:stats.solde>0?'#b45309':'#0f6e56', marginBottom:2 }}>{stats.solde>0?'+'+stats.solde:stats.solde}</div>
            <div style={{ fontSize:12, color:'#888' }}>Restant à rattraper</div>
          </div>
        </div>
        {stats.derniereDate && <p style={{ fontSize:12, color:'#aaa', marginBottom:16 }}>Dernier cours : {new Date(stats.derniereDate+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>}

        {stats.statsParCours.length > 0 && <>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Assiduité par cours</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {stats.statsParCours.map(s => (
              <div key={s.cours?.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#FF0099', flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{s.cours?.nom||'?'}</span>
                  <span style={{ fontSize:12, color:s.taux>=80?'#0f6e56':s.taux>=50?'#b45309':'#E24B4A', fontWeight:500 }}>{s.taux}%</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'#888' }}>
                  <span style={{ color:'#FF0099' }}>{s.suivis} suivis</span>
                  <span>{s.manques} manqués</span>
                  <span>sur {s.total} séances</span>
                </div>
                <div style={{ height:4, background:'#f0f0f0', borderRadius:2, marginTop:8, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.taux}%`, background:s.taux>=80?'#1D9E75':s.taux>=50?'#BA7517':'#E24B4A', borderRadius:2 }}/>
                </div>
              </div>
            ))}
          </div>
        </>}

        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Toutes les sessions</p>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {sessions.slice(0,30).map((s,i) => {
            const dateStr = new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
            const colors = { present:{bg:'rgba(255,0,153,0.07)',color:'#FF0099',label:'Présent'}, rattrapage:{bg:'rgba(204,255,0,0.1)',color:'#3a5000',label:'Rattrapage'}, absent:{bg:'#f8f8f8',color:'#aaa',label:'Absent'} }
            const st = colors[s.statut]
            return (
              <div key={i} style={{ background:st.bg, borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:12, color:'#888', minWidth:48 }}>{dateStr}</span>
                <span style={{ fontSize:13, flex:1 }}>{s.cours}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, color:st.color, border:`1px solid ${st.color}20`, fontWeight:500 }}>{st.label}</span>
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
  const location = useLocation()
  const membreIdFromNav = location.state?.membreId
  const { membres, online, archiverMembre } = useData()
  const [search, setSearch] = useState('')
  const [vue, setVue] = useState('liste')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  // Ouvrir directement une fiche depuis le dashboard
  useEffect(() => {
    if (membreIdFromNav && membres.length > 0) {
      const m = membres.find(x=>x.id===membreIdFromNav)
      if (m) { setSelected(m); setVue('fiche') }
    }
  }, [membreIdFromNav, membres])

  async function archiver(membre) {
    if (!online) { showToast('Archivage impossible hors ligne'); return }
    if (!window.confirm(`Archiver ${membre.nom} ?`)) return
    await archiverMembre(membre.id)
    showToast('Membre archivé')
    setVue('liste'); setSelected(null)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const filtered = membres.filter(m => {
    const s = search.toLowerCase()
    return !s || m.nom.toLowerCase().includes(s) || (m.abonnement||'').toLowerCase().includes(s)
  })

  if (vue === 'fiche' && selected) {
    return (
      <div>
        <FicheMembre membre={selected}
          onClose={()=>{setVue('liste');setSelected(null)}}
          onEdit={()=>setModal(selected)}
          onArchiver={()=>archiver(selected)} />
        {modal && (
          <Modal titre={`Modifier — ${modal.nom}`} onClose={()=>setModal(null)}>
            <FormMembre initial={modal}
              onSave={()=>{ setModal(null); showToast('Membre modifié !') }}
              onClose={()=>setModal(null)} />
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
        <button style={BTN.primary} onClick={()=>setModal('nouveau')}>+ Nouveau membre</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-val" style={{ color:'#FF0099' }}>{membres.length}</div><div className="stat-lbl">Membres actifs</div></div>
        <div className="stat-card"><div className="stat-val">{membres.filter(m=>m.abonnement).length}</div><div className="stat-lbl">Avec abonnement</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: !online?'#888':'#1a1a1a' }}>{online?'En ligne':'Hors ligne'}</div><div className="stat-lbl">Statut réseau</div></div>
      </div>

      <input type="text" placeholder="Rechercher un membre…" value={search} onChange={e=>setSearch(e.target.value)}
        style={{ ...INPUT, marginBottom:12 }} />

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px', gap:8, padding:'0 14px 6px', fontSize:11, color:'#aaa', fontWeight:500 }}>
          <span>Membre</span>
          <span style={{ textAlign:'center' }}>Assiduité</span>
          <span style={{ textAlign:'center' }}>Rattrap.</span>
        </div>
        {filtered.map(m => {
          const coul = couleur(m.id)
          let taux=null, solde=0
          try {
            const cache = JSON.parse(localStorage.getItem('happycath_dashboard_cache')||'null')
            if (cache) { const s=cache.statsMembres?.find(x=>x.id===m.id); if(s){taux=s.taux;solde=s.solde||0} }
          } catch(e){}
          const tauxColor = taux!==null?(taux>=80?'#0f6e56':taux>=60?'#BA7517':'#E24B4A'):'#ccc'
          return (
            <div key={m.id} onClick={()=>{setSelected(m);setVue('fiche')}}
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
                {taux!==null?<>
                  <div style={{ width:28, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${taux}%`, height:'100%', background:tauxColor, borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:tauxColor }}>{taux}%</span>
                </>:<span style={{ fontSize:11, color:'#ddd' }}>—</span>}
              </div>
              <div style={{ textAlign:'center' }}>
                {solde>0
                  ?<span style={{ fontSize:12, fontWeight:500, color:solde>3?'#E24B4A':'#b45309', background:solde>3?'#fef2f2':'#fff8e6', padding:'2px 7px', borderRadius:6 }}>{solde}</span>
                  :<span style={{ fontSize:11, color:'#ddd' }}>—</span>}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p style={{ color:'#aaa', fontSize:14, textAlign:'center', padding:24 }}>Aucun membre trouvé</p>}
      </div>

      {modal && (
        <Modal titre={modal==='nouveau'?'Nouveau membre':`Modifier — ${modal.nom}`} onClose={()=>setModal(null)}>
          <FormMembre initial={modal==='nouveau'?null:modal}
            onSave={()=>{setModal(null);showToast(modal==='nouveau'?'Membre créé !':'Membre modifié !')}}
            onClose={()=>setModal(null)} />
        </Modal>
      )}

      {toast && <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>✓ {toast}</div>}
    </div>
  )
}
