import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../lib/store'

const JOURS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function initiales(nom) { return (nom||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  outline: { padding:'9px 18px', borderRadius:8, border:'1px solid #FF0099', background:'transparent', color:'#FF0099', cursor:'pointer', fontSize:14 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
}
const INPUT = { width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:14, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }

function Modal({ titre, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── FORMULAIRE COURS ───────────────────────────────────────────
function FormCours({ initial, onSave, onClose }) {
  const { sauvegarderCours } = useData()
  const [form, setForm] = useState(initial || { nom:'', jour:1, heure:'09h00', duree:'60min', coach:'', capacite_max:15 })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.nom.trim() || !form.coach.trim()) return
    setSaving(true)
    const id = initial?.id || ('c' + Date.now().toString(36))
    await sauvegarderCours({ id, ...form, jour:parseInt(form.jour), capacite_max:parseInt(form.capacite_max)||15 })
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Nom du cours *</label>
        <input style={INPUT} value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder="ex: Pilates…" autoFocus />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Jour *</label>
          <select style={INPUT} value={form.jour} onChange={e=>set('jour',e.target.value)}>
            {JOURS_FULL.map((j,i) => <option key={i} value={i}>{j}</option>)}
          </select></div>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Heure *</label>
          <input style={INPUT} value={form.heure} onChange={e=>set('heure',e.target.value)} placeholder="09h00" /></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Durée</label>
          <input style={INPUT} value={form.duree} onChange={e=>set('duree',e.target.value)} placeholder="60min" /></div>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Coach *</label>
          <input style={INPUT} value={form.coach} onChange={e=>set('coach',e.target.value)} placeholder="Prénom" /></div>
        <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Places max</label>
          <input style={INPUT} type="number" min="1" max="100" value={form.capacite_max||15} onChange={e=>set('capacite_max',e.target.value)} /></div>
      </div>
      <div style={{ display:'flex', gap:8, paddingTop:4 }}>
        <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer le cours'}
        </button>
      </div>
    </div>
  )
}

// ─── PLANNING ───────────────────────────────────────────────────
function Planning({ cours, inscriptions, onStartAppel, onVoirHistorique, onEditCours, onDeleteCours, onNouveauCours, online }) {
  const aujourdJour = new Date().getDay()
  const [jourActif, setJourActif] = useState(aujourdJour)
  const coursDuJour = [...cours].filter(c=>c.jour===jourActif).sort((a,b)=>a.heure.localeCompare(b.heure))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cours & appel</h1>
        <button style={BTN.primary} onClick={onNouveauCours}>+ Nouveau cours</button>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto', paddingBottom:2 }}>
        {JOURS.map((j,i) => {
          const hasCours = cours.some(c=>c.jour===i)
          const isToday = i===aujourdJour, isActif = i===jourActif
          return (
            <button key={i} onClick={()=>setJourActif(i)}
              style={{ flexShrink:0, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${isActif?'#FF0099':isToday?'rgba(255,0,153,0.3)':'rgba(0,0,0,0.1)'}`, background:isActif?'#FF0099':'transparent', color:isActif?'#fff':isToday?'#FF0099':'#666', cursor:'pointer', fontSize:13, fontWeight:isToday||isActif?500:400, position:'relative' }}>
              {j}
              {hasCours && <span style={{ position:'absolute', top:3, right:3, width:4, height:4, borderRadius:'50%', background:isActif?'rgba(255,255,255,0.8)':'#FF0099' }}/>}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <p style={{ fontSize:13, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{JOURS_FULL[jourActif]}</p>
        {jourActif===aujourdJour && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(255,0,153,0.1)', color:'#FF0099', fontWeight:500 }}>Aujourd'hui</span>}
      </div>
      {coursDuJour.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#aaa' }}>
          <p style={{ fontSize:28, marginBottom:10 }}>📋</p>
          <p style={{ fontSize:14, marginBottom:12 }}>Aucun cours ce jour</p>
          <button style={{ ...BTN.outline, fontSize:13 }} onClick={onNouveauCours}>+ Ajouter un cours</button>
        </div>
      ) : coursDuJour.map(c => {
        const nb = inscriptions.filter(i=>i.cours_id===c.id).length
        return (
          <div key={c.id} style={{ background:'#fff', border:`0.5px solid ${jourActif===aujourdJour?'rgba(255,0,153,0.15)':'rgba(0,0,0,0.08)'}`, borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{ textAlign:'center', minWidth:52, paddingTop:2 }}>
                <div style={{ fontSize:15, fontWeight:600 }}>{c.heure}</div>
                <div style={{ fontSize:11, color:'#aaa' }}>{c.duree}</div>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15, fontWeight:500, margin:'0 0 3px' }}>{c.nom}</p>
                <p style={{ fontSize:12, color:'#888', margin:'0 0 10px' }}>{c.coach} · {nb} inscrit{nb!==1?'s':''} / {c.capacite_max||15} places</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button onClick={()=>onStartAppel(c)} style={{ ...BTN.primary, fontSize:12, padding:'6px 14px' }}>
                    {jourActif===aujourdJour ? "Faire l'appel" : 'Appel rétroactif'}
                  </button>
                  <button onClick={()=>onVoirHistorique(c)} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Historique</button>
                  <button onClick={()=>onEditCours(c)} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Modifier</button>
                  {online && <button onClick={()=>onDeleteCours(c)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#ccc', padding:'6px 8px' }}>Supprimer</button>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ÉCRAN APPEL ────────────────────────────────────────────────
function EcranAppel({ cours, onValider, onAnnuler, appelExistant }) {
  const { inscritsDuCours, membres, online, historique } = useData()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(appelExistant?.date || today)
  const inscrits = inscritsDuCours(cours.id)
  // 3 états : null = non renseigné, true = présent, false = absent
  function initStatuts() {
    const s = {}
    if (appelExistant) {
      // Recharger depuis un appel existant
      // Les absents sont ceux dans la liste inscrits mais pas dans presents
      const presentsSet = new Set(appelExistant.presents || [])
      inscrits.forEach(m => { s[m.id] = presentsSet.has(m.id) ? true : false })
    }
    return s
  }
  const [statuts, setStatuts] = useState(initStatuts)

  function cycleStatut(id) {
    setStatuts(prev => {
      const actuel = prev[id] // undefined/null → présent → absent → null
      if (actuel === undefined || actuel === null) return { ...prev, [id]: true }
      if (actuel === true) return { ...prev, [id]: false }
      return { ...prev, [id]: null }
    })
  }
  const [showRattrapage, setShowRattrapage] = useState(false)
  const [showEssai, setShowEssai] = useState(false)
  const [searchRattrapage, setSearchRattrapage] = useState('')
  const [rattrapages, setRattrapages] = useState((appelExistant?.guests||[]).filter(g=>g.type==='rattrapage').map(g=>({id:g.membreId,nom:g.nom})))
  const [essais, setEssais] = useState((appelExistant?.guests||[]).filter(g=>g.type==='essai'))
  const [nomEssai, setNomEssai] = useState('')
  const [saving, setSaving] = useState(false)
  const [doublonInfo, setDoublonInfo] = useState(null)

  function togglePresent(id) { setPresents(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n}) }

  function addRattrapage(m) {
    if (rattrapages.find(r=>r.id===m.id)) return
    setRattrapages(prev=>[...prev,m].sort((a,b)=>a.nom.localeCompare(b.nom)))
    setStatuts(prev=>({...prev,[m.id]:true}))
    setShowRattrapage(false); setSearchRattrapage('')
  }

  function addEssai() {
    if (!nomEssai.trim()) return
    setEssais(prev=>[...prev,{id:'essai_'+Date.now(),nom:nomEssai.trim(),type:'essai'}])
    setNomEssai(''); setShowEssai(false)
  }

  async function handleValider() {
    setSaving(true)
    if (!appelExistant && online) {
      const doublon = historique.find(h=>h.cours_id===cours.id&&h.date===date)
      if (doublon) { setDoublonInfo(doublon); setSaving(false); return }
    }
    await sauvegarder(appelExistant?.id)
    setSaving(false)
  }

  async function sauvegarder(idExistant) {
    const hId = idExistant || ('h'+Date.now().toString(36))
    const presentsIds = Object.entries(statuts).filter(([,v])=>v===true).map(([k])=>k)
    const absentsIds = Object.entries(statuts).filter(([,v])=>v===false).map(([k])=>k)
    const guests = [
      ...rattrapages.map(r=>({nom:r.nom,membreId:r.id,type:'rattrapage'})),
      ...essais.map(e=>({nom:e.nom,membreId:null,type:'essai'}))
    ]
    await onValider({ id:hId, coursId:cours.id, coursNom:cours.nom, date, presents:presentsIds, absents:absentsIds, guests })
  }

  const inscritIds = new Set(inscrits.map(m=>m.id))
  const rattrapageIds = new Set(rattrapages.map(r=>r.id))
  const membresDispo = membres.filter(m=>!inscritIds.has(m.id)&&!rattrapageIds.has(m.id)&&m.nom.toLowerCase().includes(searchRattrapage.toLowerCase()))
  const nbPresents = Object.values(statuts).filter(v=>v===true).length + essais.length
  const nbAbsents = Object.values(statuts).filter(v=>v===false).length
  const nbNonRenseignes = inscrits.filter(m=>statuts[m.id]===undefined||statuts[m.id]===null).length
  const nbTotal = inscrits.length + rattrapages.length + essais.length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={onAnnuler} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>{cours.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{cours.heure} · {cours.coach}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:24, fontWeight:500, color:'#FF0099' }}>{nbPresents}<span style={{ fontSize:14, color:'#aaa', fontWeight:400 }}>/{nbTotal}</span></div>
          <div style={{ fontSize:11, color:'#aaa' }}>
            {nbAbsents > 0 && <span style={{ color:'#E24B4A', marginRight:6 }}>{nbAbsents} absent{nbAbsents>1?'s':''}</span>}
            {nbNonRenseignes > 0 && <span style={{ color:'#bbb' }}>{nbNonRenseignes} non renseigné{nbNonRenseignes>1?'s':''}</span>}
          </div>
        </div>
      </div>

      <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:13, color:'#888', flex:1 }}>Date du cours</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ border:'none', fontSize:14, fontWeight:500, background:'transparent', color:'#1a1a1a', cursor:'pointer' }} />
      </div>

      {doublonInfo && (
        <div style={{ background:'#fff8e6', border:'1px solid #f59e0b', borderRadius:12, padding:16, marginBottom:16 }}>
          <p style={{ fontSize:14, fontWeight:500, marginBottom:6, color:'#92400e' }}>⚠️ Un appel existe déjà pour cette date</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={()=>{setDoublonInfo(null);onAnnuler()}} style={{ ...BTN.ghost, width:'100%', padding:'10px 14px', textAlign:'left' }}>Ouvrir l'existant sans modifier</button>
            <button onClick={async()=>{setDoublonInfo(null);setSaving(true);await sauvegarder(doublonInfo.id);setSaving(false)}} style={{ ...BTN.primary, width:'100%', padding:'10px 14px' }}>Remplacer</button>
            <button onClick={()=>setDoublonInfo(null)} style={{ ...BTN.ghost, width:'100%', padding:'10px 14px', textAlign:'left' }}>Annuler</button>
          </div>
        </div>
      )}

      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Inscrits ({inscrits.length})</p>
      <p style={{ fontSize:11, color:'#bbb', marginBottom:10 }}>Appuyer une fois = présent · deux fois = absent · trois fois = effacer</p>
      <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
        {inscrits.length === 0 && <p style={{ fontSize:13, color:'#aaa', padding:'10px 0' }}>Aucun inscrit — gérez les inscriptions depuis le module Membres</p>}
        {inscrits.map(m => {
          const statut = statuts[m.id] // true=présent, false=absent, null/undefined=non renseigné
          const estPresent = statut === true
          const estAbsent = statut === false
          const nonRenseigne = statut === undefined || statut === null

          const bg = estPresent ? 'rgba(255,0,153,0.05)' : estAbsent ? 'rgba(226,75,74,0.04)' : '#fff'
          const border = estPresent ? '#FF0099' : estAbsent ? '#E24B4A' : 'rgba(0,0,0,0.08)'
          const avatarBg = estPresent ? '#FF0099' : estAbsent ? '#E24B4A' : '#f0f0f0'
          const avatarColor = estPresent || estAbsent ? '#fff' : '#bbb'
          const avatarContent = estPresent ? '✓' : estAbsent ? '✗' : initiales(m.nom)
          const labelColor = estPresent ? '#FF0099' : estAbsent ? '#E24B4A' : '#ddd'
          const label = estPresent ? 'Présent' : estAbsent ? 'Absent' : '—'

          return (
            <div key={m.id} onClick={()=>cycleStatut(m.id)}
              style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', userSelect:'none', transition:'all .15s' }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:avatarBg, color:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, flexShrink:0, transition:'all .15s' }}>
                {avatarContent}
              </div>
              <span style={{ flex:1, fontSize:14, fontWeight:estPresent?500:400 }}>{m.nom}</span>
              <span style={{ fontSize:12, fontWeight:500, color:labelColor }}>{label}</span>
            </div>
          )
        })}
      </div>

      {rattrapages.length > 0 && <>
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Rattrapages ({rattrapages.length})</p>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          {rattrapages.map(m => (
            <div key={m.id} style={{ background:'rgba(204,255,0,0.07)', border:'1.5px solid #aad000', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'#aad000', color:'#3a5000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:500, flexShrink:0 }}>✓</div>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.nom}</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(204,255,0,0.2)', color:'#3a5000' }}>Rattrapage</span>
              <button onClick={()=>{setRattrapages(prev=>prev.filter(r=>r.id!==m.id));setStatuts(prev=>({...prev,[m.id]:null}))}} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:20, lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      {essais.length > 0 && <>
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Essais ({essais.length})</p>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          {essais.map(e => (
            <div key={e.id} style={{ background:'rgba(55,138,221,0.05)', border:'1.5px solid #85b7eb', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'#85b7eb', color:'#042c53', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:500, flexShrink:0 }}>?</div>
              <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{e.nom}</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(55,138,221,0.12)', color:'#185fa5' }}>Essai</span>
              <button onClick={()=>setEssais(prev=>prev.filter(x=>x.id!==e.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:20, lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>{setShowRattrapage(!showRattrapage);setShowEssai(false)}} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px dashed #aad000', background:showRattrapage?'rgba(204,255,0,0.1)':'transparent', color:'#3a5000', fontSize:13, cursor:'pointer', fontWeight:500 }}>+ Rattrapage</button>
        <button onClick={()=>{setShowEssai(!showEssai);setShowRattrapage(false)}} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px dashed #85b7eb', background:showEssai?'rgba(55,138,221,0.08)':'transparent', color:'#185fa5', fontSize:13, cursor:'pointer', fontWeight:500 }}>+ Essai / externe</button>
      </div>

      {showRattrapage && (
        <div style={{ background:'#f8f8f8', borderRadius:12, padding:14, marginBottom:14 }}>
          <input type="text" placeholder="Rechercher un membre…" value={searchRattrapage} onChange={e=>setSearchRattrapage(e.target.value)} style={{ ...INPUT, marginBottom:8 }} autoFocus />
          <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {membresDispo.slice(0,30).map(m => (
              <div key={m.id} onClick={()=>addRattrapage(m)} style={{ padding:'8px 12px', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:10, border:'0.5px solid rgba(0,0,0,0.07)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, flexShrink:0 }}>{initiales(m.nom)}</div>
                <span style={{ flex:1 }}>{m.nom}</span>
              </div>
            ))}
            {membresDispo.length === 0 && <p style={{ fontSize:13, color:'#aaa', textAlign:'center', padding:8 }}>Aucun membre trouvé</p>}
          </div>
        </div>
      )}

      {showEssai && (
        <div style={{ background:'#f8f8f8', borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ display:'flex', gap:8 }}>
            <input type="text" placeholder="Nom et prénom" value={nomEssai} onChange={e=>setNomEssai(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addEssai()} style={{ ...INPUT, flex:1 }} autoFocus />
            <button onClick={addEssai} style={{ ...BTN.primary, whiteSpace:'nowrap' }}>Ajouter</button>
          </div>
        </div>
      )}

      <button onClick={handleValider} disabled={saving} style={{ ...BTN.primary, width:'100%', padding:14, fontSize:16, borderRadius:12, marginBottom:8, opacity:saving?0.7:1 }}>
        {saving ? 'Enregistrement…' : `✓ Valider — ${nbPresents} présent${nbPresents>1?'s':''}${nbAbsents>0?` · ${nbAbsents} absent${nbAbsents>1?'s':''}`:''}`}
      </button>
      <button onClick={onAnnuler} style={{ ...BTN.ghost, width:'100%', padding:11, borderRadius:12 }}>Annuler</button>
    </div>
  )
}

// ─── HISTORIQUE ─────────────────────────────────────────────────
function HistoriqueCours({ cours, onRetour, onEditer }) {
  const { appelsDuCours, membres, supprimerAppel, online } = useData()
  const [search, setSearch] = useState('')
  const histo = appelsDuCours(cours.id)

  function getNom(id) { return membres.find(m=>m.id===id)?.nom || id }

  const filtered = histo.filter(h => {
    const s = search.toLowerCase()
    return !s || (h.cours_nom||'').toLowerCase().includes(s) || (h.date||'').includes(s)
  })

  async function handleSupprimer(id) {
    if (!online) { alert('Suppression impossible hors ligne'); return }
    if (!window.confirm('Supprimer cet appel ?')) return
    await supprimerAppel(id)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={onRetour} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>Historique — {cours.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{histo.length} appel{histo.length>1?'s':''}</p>
        </div>
      </div>
      <input type="text" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...INPUT, marginBottom:14 }} />
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(h => {
          const presentsNoms = (h.presents||[]).map(id=>getNom(id))
          const rattrapages = (h.guests||[]).filter(g=>g.type==='rattrapage')
          const essais = (h.guests||[]).filter(g=>g.type==='essai')
          const nbTotal = presentsNoms.length + (h.guests||[]).length
          const dateStr = new Date(h.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})
          return (
            <div key={h.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14, fontWeight:500, margin:'0 0 3px', textTransform:'capitalize' }}>{dateStr}</p>
                  <p style={{ fontSize:12, color:'#888', margin:0 }}>{nbTotal} présent{nbTotal>1?'s':''}
                    {rattrapages.length>0&&` · ${rattrapages.length} rattrapage${rattrapages.length>1?'s':''}`}
                    {essais.length>0&&` · ${essais.length} essai${essais.length>1?'s':''}`}
                  </p>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>onEditer(h)} style={{ ...BTN.ghost, fontSize:12, padding:'5px 10px' }}>Modifier</button>
                  {online && <button onClick={()=>handleSupprimer(h.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:16, padding:'5px 4px' }}>🗑</button>}
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {presentsNoms.map((nom,i) => <span key={i} style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'rgba(255,0,153,0.08)', color:'#FF0099' }}>{nom}</span>)}
                {rattrapages.map((r,i) => <span key={'r'+i} style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'rgba(204,255,0,0.15)', color:'#3a5000' }}>{r.nom} ↩</span>)}
                {essais.map((e,i) => <span key={'e'+i} style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'rgba(55,138,221,0.1)', color:'#185fa5' }}>{e.nom} ✦</span>)}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p style={{ color:'#aaa', fontSize:14, textAlign:'center', padding:24 }}>Aucun appel trouvé</p>}
      </div>
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────
export default function Cours() {
  const [searchParams] = useSearchParams()
  const { cours, inscriptions, sauvegarderAppel, supprimerCours, online, historique } = useData()
  const [vue, setVue] = useState('planning')
  const [coursSelectionne, setCoursSelectionne] = useState(null)
  const [appelExistant, setAppelExistant] = useState(null)
  const [modalCours, setModalCours] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const id = searchParams.get('appel')
    if (id && cours.length > 0) {
      const c = cours.find(x=>x.id===id)
      if (c) startAppel(c)
    }
  }, [cours, searchParams])

  function startAppel(c) {
    const today = new Date().toISOString().split('T')[0]
    const existant = historique.find(h=>h.cours_id===c.id&&h.date===today)
    setCoursSelectionne(c)
    setAppelExistant(existant || null)
    setVue('appel')
  }

  async function validerAppel({ id, coursId, coursNom, date, presents, absents, guests }) {
    await sauvegarderAppel({ id, cours_id:coursId, cours_nom:coursNom, date, presents, absents: absents||[], guests })
    const nbPresents = presents.length + guests.length
    showToast(`Appel enregistré — ${nbPresents} présent(s)${absents?.length?` · ${absents.length} absent(s)`:''}`)
    setVue('planning'); setCoursSelectionne(null); setAppelExistant(null)
  }

  async function handleSupprimerCours(c) {
    if (!online) { showToast('Suppression impossible hors ligne'); return }
    if (!window.confirm(`Supprimer le cours "${c.nom}" ?`)) return
    await supprimerCours(c.id)
    showToast('Cours supprimé')
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  return (
    <div>
      {vue === 'planning' && (
        <Planning cours={cours} inscriptions={inscriptions} online={online}
          onStartAppel={startAppel}
          onVoirHistorique={c=>{setCoursSelectionne(c);setVue('historique')}}
          onEditCours={c=>setModalCours(c)}
          onDeleteCours={handleSupprimerCours}
          onNouveauCours={()=>setModalCours('nouveau')} />
      )}
      {vue === 'appel' && coursSelectionne && (
        <EcranAppel cours={coursSelectionne} appelExistant={appelExistant}
          onValider={validerAppel}
          onAnnuler={()=>{setVue('planning');setCoursSelectionne(null);setAppelExistant(null)}} />
      )}
      {vue === 'historique' && coursSelectionne && (
        <HistoriqueCours cours={coursSelectionne}
          onRetour={()=>{setVue('planning');setCoursSelectionne(null)}}
          onEditer={h=>{setAppelExistant(h);setCoursSelectionne(cours.find(c=>c.id===h.cours_id)||coursSelectionne);setVue('appel')}} />
      )}

      {modalCours && (
        <Modal titre={modalCours==='nouveau'?'Nouveau cours':`Modifier — ${modalCours.nom}`} onClose={()=>setModalCours(null)}>
          <FormCours initial={modalCours==='nouveau'?null:modalCours}
            onSave={()=>{setModalCours(null);showToast(modalCours==='nouveau'?'Cours créé !':'Cours modifié !')}}
            onClose={()=>setModalCours(null)} />
        </Modal>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
