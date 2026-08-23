import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useData } from '../lib/store'
import { lireFichierSportEasy, parserRosterMembres, suggererMembreExistant, CHAMPS_LABELS } from '../lib/sporteasyImport'

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
  const { abonnements, saisonActive } = useData()
  const abo = abonnements.find(a=>a.membre_id===membreId&&a.saison===saisonActive&&a.statut==='actif')
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
  const { cours, inscriptions, sauvegarderMembre, sauvegarderInscriptions, sauvegarderAbonnement, abonnements, saisonActive } = useData()
  const [form, setForm] = useState(initial || { nom:'', telephone:'', email:'', notes:'' })
  const [inscrits, setInscrits] = useState(
    initial ? inscriptions.filter(i=>i.membre_id===initial.id).map(i=>i.cours_id) : []
  )
  const [abo, setAbo] = useState({ type:'Annuel', date_debut:'', date_fin:'', montant:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (initial?.id) {
      const aboActif = abonnements.find(a=>a.membre_id===initial.id&&a.saison===saisonActive&&a.statut==='actif')
      if (aboActif) setAbo({ type:aboActif.type, date_debut:aboActif.date_debut||'', date_fin:aboActif.date_fin||'', montant:aboActif.montant||'' })
    }
  }, [initial?.id, abonnements, saisonActive])

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

  const coursByJour = JOURS_FULL.map((j,i)=>({jour:j,idx:i,cours:cours.filter(c=>c.jour===i && (c.actif!==false || c.ouvert_inscriptions))})).filter(g=>g.cours.length>0)

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
function FicheMembre({ membre, onClose, onEdit, onArchiver, onSupprimerDefinitif }) {
  const { cours, inscriptions, historique, reglements, online, reactiverMembre, membreSupprimable, saisonActive } = useData()
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [filtreSaison, setFiltreSaison] = useState(saisonActive)

  const saisonsDisponibles = useMemo(() => {
    const s1 = historique.map(h => h.saison)
    const s2 = reglements.filter(r => r.membre_id === membre.id).map(r => r.saison)
    return [...new Set([...s1, ...s2].filter(Boolean))].sort().reverse()
  }, [historique, reglements, membre.id])

  const reglementsMembre = useMemo(() => {
    return reglements.filter(r => r.membre_id === membre.id && (filtreSaison === 'Toutes' || r.saison === filtreSaison))
  }, [reglements, membre.id, filtreSaison])
  const montantPercu = reglementsMembre.reduce((s,r) => s + Number(r.montant||0), 0)
  const chequesEnAttente = reglementsMembre.filter(r => r.mode === 'Chèque' && r.statut === 'en_attente').reduce((s,r) => s + Number(r.montant||0), 0)

  const montantParSaison = useMemo(() => {
    const tousLesReglementsMembre = reglements.filter(r => r.membre_id === membre.id)
    const parSaison = {}
    for (const r of tousLesReglementsMembre) {
      const s = r.saison || '—'
      parSaison[s] = (parSaison[s]||0) + Number(r.montant||0)
    }
    return Object.entries(parSaison).sort((a,b) => b[0].localeCompare(a[0]))
  }, [reglements, membre.id])

  useEffect(() => {
    const historiqueFiltre = filtreSaison === 'Toutes' ? historique : historique.filter(h => h.saison === filtreSaison)
    const courIds = inscriptions.filter(i=>i.membre_id===membre.id).map(i=>i.cours_id)
    const toutesLesSessions = []
    let totalSuivis=0, totalManques=0, totalRattrapages=0, derniereDate=null

    const statsParCours = courIds.map(cId => {
      const c = cours.find(x=>x.id===cId)
      const appels = historiqueFiltre.filter(h=>h.cours_id===cId)
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

    historiqueFiltre.forEach(h => {
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
  }, [membre.id, cours, inscriptions, historique, filtreSaison])

  const coul = couleur(membre.id)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <button onClick={onClose} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ width:52, height:52, borderRadius:'50%', background:coul+'20', color:coul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:500, flexShrink:0 }}>{initiales(membre.nom)}</div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>
            {membre.nom}
            {membre.actif === false && (
              <span style={{ marginLeft:8, fontSize:11, fontWeight:500, color:'#888', background:'#eee', borderRadius:12, padding:'2px 8px', verticalAlign:'middle' }}>Archivé</span>
            )}
          </h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{membre.abonnement||'Pas de cours'}</p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Modifier</button>
          {online && membre.actif === false && (
            <button onClick={()=>reactiverMembre(membre.id)} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px', color:'#1D9E75' }}>Réactiver</button>
          )}
          {online && membre.actif === false && (
            membreSupprimable(membre.id)
              ? <button onClick={onSupprimerDefinitif} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px', color:'#E24B4A' }}>Supprimer définitivement</button>
              : <span style={{ fontSize:11, color:'#ccc', alignSelf:'center' }} title="Historique lié (appels, inscriptions, règlements ou abonnements) : archivage uniquement">Non supprimable</span>
          )}
          {online && membre.actif !== false && <button onClick={onArchiver} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:16, padding:'6px 8px' }}>🗑</button>}
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
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:10, borderTop:'0.5px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize:12, color:'#888' }}>Montant perçu {filtreSaison === 'Toutes' ? '(toutes saisons)' : `— ${filtreSaison}`}</span>
          <span style={{ fontSize:16, fontWeight:600, color:'#FF0099' }}>
            {montantPercu.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 })} €
          </span>
        </div>
        {chequesEnAttente > 0 && (
          <p style={{ fontSize:11, color:'#BA7517', margin:'4px 0 0' }}>
            dont {chequesEnAttente.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 })} € de chèque(s) pas encore encaissé(s)
          </p>
        )}
        {montantParSaison.length > 1 && (
          <div style={{ marginTop:10, paddingTop:10, borderTop:'0.5px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', gap:3 }}>
            {montantParSaison.map(([saison, montant]) => (
              <div key={saison} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888' }}>
                <span>{saison}{saison===saisonActive ? ' (active)' : ''}</span>
                <span>{montant.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 })} €</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:0 }}>Bilan {filtreSaison === 'Toutes' ? '(toutes saisons)' : filtreSaison}</p>
          <select
            value={filtreSaison}
            onChange={e=>setFiltreSaison(e.target.value)}
            style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', background:'#fff', color:'#666' }}
          >
            {saisonsDisponibles.map(s => <option key={s} value={s}>{s}{s===saisonActive?' (active)':''}</option>)}
            <option value="Toutes">Toutes les saisons</option>
          </select>
        </div>
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

        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
          Sessions {filtreSaison === 'Toutes' ? '(toutes saisons)' : `— ${filtreSaison}`}
        </p>
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
// ─── IMPORT ROSTER (fiches nominatives : stage, adhérents...) ──────
function ImportRoster({ onClose }) {
  const { membres, mettreAJourMembres } = useData()
  const [statut, setStatut] = useState('idle')
  const [erreur, setErreur] = useState(null)
  const [personnes, setPersonnes] = useState([])
  const [resolutions, setResolutions] = useState({})
  const [diffs, setDiffs] = useState([])
  const [resultat, setResultat] = useState(null)

  async function onFichier(e) {
    const f = e.target.files[0]
    if (!f) return
    setStatut('lecture'); setErreur(null)
    try {
      const rows = await lireFichierSportEasy(f)
      const p = parserRosterMembres(rows)
      setPersonnes(p)
      const init = {}
      for (const pers of p) {
        const sugg = suggererMembreExistant(pers.nomFichier, membres)
        init[pers._ligne] = sugg ? sugg.id : 'ignorer'
      }
      setResolutions(init)
      setStatut('matching')
    } catch (err) {
      console.error(err)
      setErreur("Impossible de lire ce fichier (.xlsx attendu).")
      setStatut('erreur')
    }
  }

  function construireDiffs() {
    const items = []
    for (const pers of personnes) {
      const mid = resolutions[pers._ligne]
      if (!mid || mid === 'ignorer') continue
      const membre = membres.find(m => m.id === mid)
      if (!membre) continue
      const champsAuto = {}
      const champsAmbigus = []
      for (const [cle, nouveau] of Object.entries(pers.champs)) {
        if (nouveau === null || nouveau === undefined || nouveau === '') continue
        const ancien = membre[cle]
        if (ancien === null || ancien === undefined || ancien === '') {
          champsAuto[cle] = nouveau
        } else if (String(ancien) !== String(nouveau)) {
          champsAmbigus.push({ cle, ancien, nouveau, choix: 'ancien' })
        }
      }
      if (Object.keys(champsAuto).length || champsAmbigus.length) {
        items.push({ membreId: mid, nom: membre.nom, champsAuto, champsAmbigus })
      }
    }
    setDiffs(items)
    setStatut('diffs')
  }

  function setChoix(membreId, cle, choix) {
    setDiffs(prev => prev.map(d => d.membreId === membreId
      ? { ...d, champsAmbigus: d.champsAmbigus.map(c => c.cle === cle ? { ...c, choix } : c) }
      : d))
  }

  async function appliquer() {
    setStatut('application')
    const patches = diffs.map(d => {
      const champs = { ...d.champsAuto }
      for (const c of d.champsAmbigus) {
        if (c.choix === 'nouveau') champs[c.cle] = c.nouveau
      }
      return { id: d.membreId, champs }
    }).filter(p => Object.keys(p.champs).length > 0)
    const res = await mettreAJourMembres(patches)
    if (res.error) { setErreur(res.error); setStatut('erreur') }
    else { setResultat(res); setStatut('fait') }
  }

  return (
    <Modal titre="Compléter les fiches depuis un fichier" onClose={onClose}>
      {statut === 'idle' && (
        <div>
          <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
            Dépose un fichier "fiches nominatives" (ex: roster de stage, liste adhérents SportEasy avec téléphone, date de naissance, consentements...).
            Seuls les membres déjà existants dans l'appli sont mis à jour — les nouveaux noms ne sont pas créés ici.
          </p>
          <label style={{ display:'inline-block' }}>
            <input type="file" accept=".xlsx" onChange={onFichier} style={{ display:'none' }} />
            <span style={BTN.primary}>📂 Choisir un fichier .xlsx</span>
          </label>
        </div>
      )}

      {statut === 'lecture' && <p style={{ color:'#888', fontSize:14 }}>Lecture du fichier…</p>}

      {statut === 'erreur' && (
        <div>
          <p style={{ color:'#D85A30', fontSize:14, marginBottom:12 }}>⚠ {erreur}</p>
          <button style={BTN.ghost} onClick={onClose}>Fermer</button>
        </div>
      )}

      {statut === 'matching' && (
        <div>
          <p style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Fais correspondre chaque personne ({personnes.length})</p>
          <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>
            Les personnes non trouvées dans l'appli (stagiaires non-adhérents par ex.) restent sur "Ignorer" — on gèrera les stages séparément plus tard.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16, maxHeight:400, overflowY:'auto' }}>
            {personnes.map(p => (
              <div key={p._ligne} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f7f7f8', borderRadius:10, flexWrap:'wrap' }}>
                <span style={{ fontWeight:500, minWidth:160 }}>{p.nomFichier}</span>
                <select
                  style={{ ...INPUT, width:'auto', flex:1, minWidth:220, padding:'6px 10px' }}
                  value={resolutions[p._ligne] || 'ignorer'}
                  onChange={e => setResolutions(prev => ({ ...prev, [p._ligne]: e.target.value }))}
                >
                  <option value="ignorer">— Ignorer (pas encore adhérent) —</option>
                  {membres.map(m => <option key={m.id} value={m.id}>🔗 {m.nom}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button style={BTN.ghost} onClick={onClose}>Annuler</button>
            <button style={BTN.primary} onClick={construireDiffs}>Continuer →</button>
          </div>
        </div>
      )}

      {statut === 'diffs' && (
        <div>
          {diffs.length === 0 ? (
            <div>
              <p style={{ fontSize:14, color:'#888', marginBottom:16 }}>Rien à mettre à jour — les fiches liées sont déjà complètes et identiques.</p>
              <button style={BTN.ghost} onClick={onClose}>Fermer</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:14, fontWeight:500, marginBottom:14 }}>Vérifie les champs à mettre à jour ({diffs.length} fiche(s))</p>
              <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16, maxHeight:440, overflowY:'auto' }}>
                {diffs.map(d => (
                  <div key={d.membreId} style={{ background:'#f7f7f8', borderRadius:10, padding:'12px 14px' }}>
                    <p style={{ fontWeight:500, margin:'0 0 8px' }}>{d.nom}</p>
                    {Object.keys(d.champsAuto).length > 0 && (
                      <p style={{ fontSize:12, color:'#1D9E75', margin:'0 0 6px' }}>
                        ✓ Complété automatiquement : {Object.keys(d.champsAuto).map(c => CHAMPS_LABELS[c]).join(', ')}
                      </p>
                    )}
                    {d.champsAmbigus.map(c => (
                      <div key={c.cle} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginTop:6, fontSize:13 }}>
                        <span style={{ minWidth:160, color:'#666' }}>{CHAMPS_LABELS[c.cle]} :</span>
                        <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                          <input type="radio" checked={c.choix==='ancien'} onChange={()=>setChoix(d.membreId, c.cle, 'ancien')} />
                          Garder « {String(c.ancien)} »
                        </label>
                        <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                          <input type="radio" checked={c.choix==='nouveau'} onChange={()=>setChoix(d.membreId, c.cle, 'nouveau')} />
                          Remplacer par « {String(c.nouveau)} »
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button style={BTN.ghost} onClick={()=>setStatut('matching')}>← Retour</button>
                <button style={BTN.primary} onClick={appliquer}>Appliquer les mises à jour</button>
              </div>
            </div>
          )}
        </div>
      )}

      {statut === 'application' && <p style={{ color:'#888', fontSize:14 }}>Mise à jour en cours…</p>}

      {statut === 'fait' && (
        <div>
          <p style={{ fontSize:14, color:'#1D9E75', fontWeight:500, marginBottom:12 }}>✓ {resultat.nb} fiche(s) mise(s) à jour.</p>
          <button style={BTN.ghost} onClick={onClose}>Fermer</button>
        </div>
      )}
    </Modal>
  )
}

export default function Membres() {
  const location = useLocation()
  const membreIdFromNav = location.state?.membreId
  const { membres, online, archiverMembre, supprimerDefinitivementMembre, inscriptions, saisonActive, cours } = useData()
  const [search, setSearch] = useState('')
  const [vue, setVue] = useState('liste')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [voirArchives, setVoirArchives] = useState(false)
  const [showImportRoster, setShowImportRoster] = useState(false)

  const selected = membres.find(m => m.id === selectedId) || null

  // Ouvrir directement une fiche depuis le dashboard
  useEffect(() => {
    if (membreIdFromNav && membres.length > 0) {
      const m = membres.find(x=>x.id===membreIdFromNav)
      if (m) { setSelectedId(m.id); setVue('fiche') }
    }
  }, [membreIdFromNav, membres])

  async function archiver(membre) {
    if (!online) { showToast('Archivage impossible hors ligne'); return }
    if (!window.confirm(`Archiver ${membre.nom} ?`)) return
    await archiverMembre(membre.id)
    showToast('Membre archivé')
    setVue('liste'); setSelectedId(null)
  }

  async function supprimerDefinitivement(membre) {
    if (!online) { showToast('Suppression impossible hors ligne'); return }
    if (!window.confirm(`Supprimer définitivement ${membre.nom} ? Cette action est irréversible.`)) return
    const res = await supprimerDefinitivementMembre(membre.id)
    if (res?.error) { showToast(res.error); return }
    showToast('Membre supprimé définitivement')
    setVue('liste'); setSelectedId(null)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const membresActifs = membres.filter(m => m.actif !== false)
  const membresArchives = membres.filter(m => m.actif === false)

  const saisonPrecedente = useMemo(() => {
    const [a, b] = saisonActive.split('-').map(Number)
    return `${a-1}-${b-1}`
  }, [saisonActive])

  const membresNonRenouveles = useMemo(() => {
    return membresActifs.filter(m => {
      const inscritAvant = inscriptions.some(i => i.membre_id === m.id && i.saison === saisonPrecedente)
      const inscritCetteAnnee = inscriptions.some(i => i.membre_id === m.id && i.saison === saisonActive)
      return inscritAvant && !inscritCetteAnnee
    })
  }, [membresActifs, inscriptions, saisonPrecedente, saisonActive])

  const base = voirArchives === 'non-renouveles' ? membresNonRenouveles : voirArchives === true ? membresArchives : membresActifs

  const filtered = base.filter(m => {
    const s = search.toLowerCase()
    return !s || m.nom.toLowerCase().includes(s) || (m.abonnement||'').toLowerCase().includes(s)
  })

  if (vue === 'fiche' && selected) {
    return (
      <div>
        <FicheMembre membre={selected}
          onClose={()=>{setVue('liste');setSelectedId(null)}}
          onEdit={()=>setModal(selected)}
          onArchiver={()=>archiver(selected)}
          onSupprimerDefinitif={()=>supprimerDefinitivement(selected)} />
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
        <div style={{ display:'flex', gap:8 }}>
          <button style={BTN.ghost} onClick={()=>setShowImportRoster(true)}>📂 Compléter des fiches</button>
          <button style={BTN.primary} onClick={()=>setModal('nouveau')}>+ Nouveau membre</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-val" style={{ color:'#FF0099' }}>{membresActifs.length}</div><div className="stat-lbl">Membres actifs</div></div>
        <div className="stat-card"><div className="stat-val">{membresActifs.filter(m=>m.abonnement).length}</div><div className="stat-lbl">Avec abonnement</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: !online?'#888':'#1a1a1a' }}>{online?'En ligne':'Hors ligne'}</div><div className="stat-lbl">Statut réseau</div></div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button
          onClick={()=>setVoirArchives(false)}
          style={{ ...BTN.ghost, ...(voirArchives===false ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>
          Actifs ({membresActifs.length})
        </button>
        <button
          onClick={()=>setVoirArchives(true)}
          style={{ ...BTN.ghost, ...(voirArchives===true ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>
          Archivés ({membresArchives.length})
        </button>
        <button
          onClick={()=>setVoirArchives('non-renouveles')}
          style={{ ...BTN.ghost, ...(voirArchives==='non-renouveles' ? { background:'#D85A30', color:'#fff', border:'none' } : { color:'#D85A30' }) }}>
          Non renouvelés {saisonActive} ({membresNonRenouveles.length})
        </button>
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
            <div key={m.id} onClick={()=>{setSelectedId(m.id);setVue('fiche')}}
              style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'10px 14px', display:'grid', gridTemplateColumns:'1fr 80px 60px', gap:8, alignItems:'center', cursor:'pointer', transition:'border-color .15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#FF0099'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.08)'}>
              <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:coul+'20', color:coul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, flexShrink:0 }}>{initiales(m.nom)}</div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:500, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.nom}</p>
                  <p style={{ fontSize:11, color:'#aaa', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {voirArchives === 'non-renouveles'
                      ? `${saisonPrecedente} : ${inscriptions.filter(i=>i.membre_id===m.id&&i.saison===saisonPrecedente).map(i=>cours.find(c=>c.id===i.cours_id)?.nom).filter(Boolean).join(', ') || '—'}`
                      : (m.abonnement||'Aucun cours')}
                  </p>
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

      {showImportRoster && <ImportRoster onClose={()=>setShowImportRoster(false)} />}

      {toast && <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>✓ {toast}</div>}
    </div>
  )
}
