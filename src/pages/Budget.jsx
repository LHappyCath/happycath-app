import { useState, useMemo } from 'react'
import { useData } from '../lib/store'

const JOURS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const CATEGORIES = ['Gym', 'Danse']

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
  small: { padding:'5px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', cursor:'pointer', fontSize:12 },
}
const INPUT = { width:'100%', padding:'7px 9px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:13, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }
const LABEL = { fontSize:12, fontWeight:500, color:'#666', marginBottom:5, display:'block' }

function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €' }

function saisonSuivante(s) {
  const [a, b] = s.split('-').map(Number)
  return `${a+1}-${b+1}`
}

// Convertit une durée texte ("55min", "1h30", "60 min") en heures décimales.
function dureeEnHeures(duree) {
  if (!duree) return 0
  const s = String(duree).toLowerCase()
  const h = s.match(/(\d+)\s*h/)
  const min = s.match(/(\d+)\s*min/)
  if (h || min) return (h ? parseInt(h[1],10) : 0) + (min ? parseInt(min[1],10) : 0) / 60
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n / 60
}

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

// ─── FORMULAIRE : NOUVEAU COURS (brouillon, pour une future saison) ────
function FormNouveauCours({ onClose, onCree }) {
  const { creerCoursBrouillon } = useData()
  const [form, setForm] = useState({ nom:'', jour:1, heure:'09h00', duree:'60min', coach:'', categorie:'Gym' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const res = await creerCoursBrouillon({ ...form, jour: parseInt(form.jour) })
    setSaving(false)
    if (res?.error) return
    onCree(res.cours)
  }

  return (
    <Modal titre="Nouveau cours (brouillon)" onClose={onClose}>
      <p style={{ fontSize:12, color:'#888', marginTop:-8, marginBottom:14 }}>
        Ce cours n'apparaîtra ni dans "Cours & appel" ni comme inscriptible tant qu'il n'aura pas été activé.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={LABEL}>Nom du cours *</label>
          <input style={INPUT} value={form.nom} onChange={e=>set('nom',e.target.value)} autoFocus />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={LABEL}>Jour</label>
            <select style={INPUT} value={form.jour} onChange={e=>set('jour',e.target.value)}>
              {JOURS_FULL.map((j,i) => <option key={i} value={i}>{j}</option>)}
            </select></div>
          <div><label style={LABEL}>Heure</label>
            <input style={INPUT} value={form.heure} onChange={e=>set('heure',e.target.value)} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div><label style={LABEL}>Durée</label>
            <input style={INPUT} value={form.duree} onChange={e=>set('duree',e.target.value)} placeholder="60min" /></div>
          <div><label style={LABEL}>Coach</label>
            <input style={INPUT} value={form.coach} onChange={e=>set('coach',e.target.value)} /></div>
          <div><label style={LABEL}>Catégorie</label>
            <select style={INPUT} value={form.categorie} onChange={e=>set('categorie',e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
        <div style={{ display:'flex', gap:8, paddingTop:4 }}>
          <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
          <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} disabled={saving || !form.nom.trim()} onClick={save}>
            {saving ? 'Création…' : 'Créer le cours'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── LIGNE DE BUDGET (un cours) ─────────────────────────────────────
function LigneBudget({ cours: c, budget, saison, onChange, onRemove, onCategorieChange }) {
  const [local, setLocal] = useState({
    nb_seances_prevues: budget?.nb_seances_prevues ?? '',
    effectif_plein_prevu: budget?.effectif_plein_prevu ?? 0,
    effectif_reduit_prevu: budget?.effectif_reduit_prevu ?? 0,
    tarif_prevu: budget?.tarif_prevu ?? c.tarif_plein ?? '',
    notes: budget?.notes ?? '',
  })

  function set(k, v) { setLocal(l => ({ ...l, [k]: v })) }

  function save() {
    onChange({
      cours_id: c.id,
      saison,
      nb_seances_prevues: parseInt(local.nb_seances_prevues, 10) || 0,
      effectif_plein_prevu: parseInt(local.effectif_plein_prevu, 10) || 0,
      effectif_reduit_prevu: parseInt(local.effectif_reduit_prevu, 10) || 0,
      tarif_prevu: Number(local.tarif_prevu) || 0,
      notes: local.notes,
    })
  }

  const effectif = (parseInt(local.effectif_plein_prevu,10)||0) + (parseInt(local.effectif_reduit_prevu,10)||0)
  const tarif = Number(local.tarif_prevu) || 0
  const caPlein = (parseInt(local.effectif_plein_prevu,10)||0) * tarif
  const caReduit = (parseInt(local.effectif_reduit_prevu,10)||0) * tarif * 0.9
  const reduction = (parseInt(local.effectif_reduit_prevu,10)||0) * tarif * 0.1
  const totalCA = caPlein + caReduit
  const heures = (parseInt(local.nb_seances_prevues,10)||0) * dureeEnHeures(c.duree)
  const estBrouillon = c.actif === false

  return (
    <div style={{ background:'#fff', border:`0.5px solid ${estBrouillon?'rgba(55,138,221,0.3)':'rgba(0,0,0,0.08)'}`, borderRadius:12, padding:'12px 14px', marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <p style={{ fontSize:14, fontWeight:500, margin:'0 0 2px' }}>
            {c.nom}
            {estBrouillon && <span style={{ marginLeft:8, fontSize:10, fontWeight:500, color:'#378ADD', background:'#378ADD20', borderRadius:8, padding:'2px 7px' }}>brouillon</span>}
          </p>
          <p style={{ fontSize:12, color:'#888', margin:0 }}>{JOURS_FULL[c.jour]} {c.heure} · {c.coach || '—'}</p>
        </div>
        <select value={c.categorie || ''} onChange={e=>onCategorieChange(c.id, e.target.value)}
          style={{ ...INPUT, width:'auto', padding:'5px 8px' }}>
          <option value="">Catégorie ?</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button onClick={onRemove} title="Retirer du budget de cette saison"
          style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:14 }}>🗑</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:10 }}>
        <div><label style={{ ...LABEL, fontSize:11 }}>Séances prévues</label>
          <input style={INPUT} type="number" min="0" value={local.nb_seances_prevues} onChange={e=>set('nb_seances_prevues', e.target.value)} onBlur={save} /></div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Effectif plein tarif</label>
          <input style={INPUT} type="number" min="0" value={local.effectif_plein_prevu} onChange={e=>set('effectif_plein_prevu', e.target.value)} onBlur={save} /></div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Effectif tarif réduit</label>
          <input style={INPUT} type="number" min="0" value={local.effectif_reduit_prevu} onChange={e=>set('effectif_reduit_prevu', e.target.value)} onBlur={save} /></div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Tarif annuel (€)</label>
          <input style={INPUT} type="number" min="0" step="0.01" value={local.tarif_prevu} onChange={e=>set('tarif_prevu', e.target.value)} onBlur={save} /></div>
      </div>

      <div>
        <label style={{ ...LABEL, fontSize:11 }}>Inscriptions potentielles / notes</label>
        <input style={INPUT} value={local.notes} onChange={e=>set('notes', e.target.value)} onBlur={save} placeholder="ex: Charlotte, Elodie (en attente)…" />
      </div>

      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10, paddingTop:10, borderTop:'0.5px solid #f5f5f5', fontSize:12, color:'#666' }}>
        <span>Effectif total : <strong>{effectif}</strong></span>
        <span>Heures totales : <strong>{heures.toFixed(1)} h</strong></span>
        {reduction > 0 && <span>Réduction : <strong>{fmtEuros(reduction)}</strong></span>}
        <span style={{ marginLeft:'auto', fontSize:14, fontWeight:600, color:'#FF0099' }}>CA prévu : {fmtEuros(totalCA)}</span>
      </div>
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────
export default function Budget() {
  const { cours, budgetCoursPrevisionnel, saisonActive, sauvegarderBudgetCours, supprimerLigneBudget, sauvegarderCours } = useData()
  const [saison, setSaison] = useState(saisonSuivante(saisonActive))
  const [showNouveauCours, setShowNouveauCours] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const saisonsDisponibles = useMemo(() => {
    const set = new Set([saisonActive, saisonSuivante(saisonActive), ...budgetCoursPrevisionnel.map(b=>b.saison)])
    return [...set].sort()
  }, [saisonActive, budgetCoursPrevisionnel])

  // Cours à afficher : cours actifs (reconductibles) + cours "brouillon" déjà budgétés pour cette saison
  const coursAffiches = useMemo(() => {
    const idsBudgetes = new Set(budgetCoursPrevisionnel.filter(b => b.saison === saison).map(b => b.cours_id))
    return cours
      .filter(c => c.actif !== false || idsBudgetes.has(c.id))
      .sort((a,b) => (a.jour - b.jour) || (a.heure||'').localeCompare(b.heure||''))
  }, [cours, budgetCoursPrevisionnel, saison])

  const lignes = useMemo(() => {
    return coursAffiches.map(c => {
      const budget = budgetCoursPrevisionnel.find(b => b.cours_id === c.id && b.saison === saison)
      const effectif = (budget?.effectif_plein_prevu||0) + (budget?.effectif_reduit_prevu||0)
      const tarif = Number(budget?.tarif_prevu ?? c.tarif_plein ?? 0)
      const totalCA = (budget?.effectif_plein_prevu||0) * tarif + (budget?.effectif_reduit_prevu||0) * tarif * 0.9
      const heures = (budget?.nb_seances_prevues||0) * dureeEnHeures(c.duree)
      return { cours: c, budget, effectif, totalCA, heures }
    })
  }, [coursAffiches, budgetCoursPrevisionnel, saison])

  const totalGeneral = lignes.reduce((s,l) => s + l.totalCA, 0)
  const totalEffectif = lignes.reduce((s,l) => s + l.effectif, 0)
  const totalHeures = lignes.reduce((s,l) => s + l.heures, 0)

  const parCategorie = useMemo(() => {
    const groupes = {}
    for (const l of lignes) {
      const cat = l.cours.categorie || 'Sans catégorie'
      if (!groupes[cat]) groupes[cat] = { ca: 0, effectif: 0 }
      groupes[cat].ca += l.totalCA
      groupes[cat].effectif += l.effectif
    }
    return Object.entries(groupes).sort((a,b) => b[1].ca - a[1].ca)
  }, [lignes])

  const parProf = useMemo(() => {
    const groupes = {}
    for (const l of lignes) {
      const prof = l.cours.coach || 'Sans prof'
      if (!groupes[prof]) groupes[prof] = { ca: 0, heures: 0 }
      groupes[prof].ca += l.totalCA
      groupes[prof].heures += l.heures
    }
    return Object.entries(groupes).sort((a,b) => b[1].ca - a[1].ca)
  }, [lignes])

  async function handleChange(payload) {
    const res = await sauvegarderBudgetCours(payload)
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  async function handleCategorieChange(coursId, categorie) {
    const c = cours.find(x => x.id === coursId)
    if (!c) return
    await sauvegarderCours({ ...c, categorie })
  }

  async function handleRemove(l) {
    if (!l.budget) return
    if (!window.confirm(`Retirer "${l.cours.nom}" du budget ${saison} ?`)) return
    await supprimerLigneBudget(l.budget.id)
    showToast('Ligne retirée du budget')
  }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <h1 className="page-title">Budget & finances</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={saison} onChange={e=>setSaison(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:13, background:'#fff', color:'#666' }}>
            {saisonsDisponibles.map(s => <option key={s} value={s}>Budget {s}{s===saisonActive?' (saison active)':''}</option>)}
          </select>
          <button style={BTN.primary} onClick={()=>setShowNouveauCours(true)}>+ Nouveau cours</button>
        </div>
      </div>

      <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
        Prévisionnel des recettes par cours pour la saison <strong>{saison}</strong>. Un cours qu'on ne reconduit pas : laisse simplement ses champs à zéro, pas besoin de le supprimer.
      </p>

      <div className="stats-grid" style={{ marginBottom:20 }}>
        <div className="stat-card"><div className="stat-val" style={{ color:'#FF0099' }}>{fmtEuros(totalGeneral)}</div><div className="stat-lbl">CA prévu total</div></div>
        <div className="stat-card"><div className="stat-val">{totalEffectif}</div><div className="stat-lbl">Effectif prévu</div></div>
        <div className="stat-card"><div className="stat-val">{totalHeures.toFixed(0)} h</div><div className="stat-lbl">Heures totales</div></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        <div className="card">
          <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Par catégorie</p>
          {parCategorie.map(([cat, v]) => (
            <div key={cat} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span>{cat} <span style={{ color:'#aaa' }}>({v.effectif})</span></span>
              <strong>{fmtEuros(v.ca)}</strong>
            </div>
          ))}
          {parCategorie.length === 0 && <p style={{ fontSize:13, color:'#aaa' }}>Aucune donnée</p>}
        </div>
        <div className="card">
          <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Par prof (aide au reversement)</p>
          {parProf.map(([prof, v]) => (
            <div key={prof} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderTop:'0.5px solid #f5f5f5' }}>
              <span>{prof} <span style={{ color:'#aaa' }}>({v.heures.toFixed(0)} h)</span></span>
              <strong>{fmtEuros(v.ca)}</strong>
            </div>
          ))}
          {parProf.length === 0 && <p style={{ fontSize:13, color:'#aaa' }}>Aucune donnée</p>}
        </div>
      </div>

      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
        Cours ({lignes.length})
      </p>
      {lignes.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p style={{ fontSize:32, marginBottom:12 }}>📊</p>
          <p style={{ fontWeight:500, marginBottom:6 }}>Aucun cours à budgétiser</p>
          <p style={{ color:'#888', fontSize:14 }}>Crée un cours ou active-en un depuis le module Cours & appel.</p>
        </div>
      ) : (
        lignes.map(l => (
          <LigneBudget key={l.cours.id} cours={l.cours} budget={l.budget} saison={saison}
            onChange={handleChange} onRemove={()=>handleRemove(l)} onCategorieChange={handleCategorieChange} />
        ))
      )}

      {showNouveauCours && (
        <FormNouveauCours onClose={()=>setShowNouveauCours(false)}
          onCree={()=>{ setShowNouveauCours(false); showToast('Cours créé — renseigne son budget ci-dessous') }} />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
