import { useState, useMemo } from 'react'
import { useData } from '../lib/store'
import { joursFeriesSaison, statutJour, compterSeances, joursDuMois, moisDeSaison, MOIS_FR } from '../lib/calendrierScolaire'

const JOURS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const JOURS_COURTS = ['D','L','M','M','J','V','S']
const CATEGORIES = ['Gym', 'Danse']

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
  small: { padding:'5px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', cursor:'pointer', fontSize:12 },
}
const INPUT = { width:'100%', padding:'7px 9px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:13, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }
const LABEL = { fontSize:12, fontWeight:500, color:'#666', marginBottom:5, display:'block' }

function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €' }
function saisonSuivante(s) { const [a, b] = s.split('-').map(Number); return `${a+1}-${b+1}` }
function defautBornes(saison) { const [a,b] = saison.split('-').map(Number); return { debut: `${a}-09-01`, fin: `${b}-06-30` } }

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
function LigneBudget({ cours: c, budget, saison, bornes, joursExceptionnelsSaison, onChange, onRemove, onCategorieChange }) {
  const [local, setLocal] = useState({
    nb_seances_prevues: budget?.nb_seances_prevues ?? '',
    effectif_plein_prevu: budget?.effectif_plein_prevu ?? 0,
    effectif_reduit_prevu: budget?.effectif_reduit_prevu ?? 0,
    tarif_prevu: budget?.tarif_prevu ?? c.tarif_plein ?? '',
    notes: budget?.notes ?? '',
  })

  function set(k, v) { setLocal(l => ({ ...l, [k]: v })) }

  function save(champsEnPlus) {
    onChange({
      cours_id: c.id,
      saison,
      nb_seances_prevues: parseInt(champsEnPlus?.nb_seances_prevues ?? local.nb_seances_prevues, 10) || 0,
      effectif_plein_prevu: parseInt(local.effectif_plein_prevu, 10) || 0,
      effectif_reduit_prevu: parseInt(local.effectif_reduit_prevu, 10) || 0,
      tarif_prevu: Number(local.tarif_prevu) || 0,
      notes: local.notes,
    })
  }

  function calculerSeances() {
    if (!bornes?.date_debut || !bornes?.date_fin) return
    const n = compterSeances({
      coursJour: c.jour, categorie: c.categorie,
      dateDebut: bornes.date_debut, dateFin: bornes.date_fin,
      joursExceptionnels: joursExceptionnelsSaison,
    })
    set('nb_seances_prevues', n)
    save({ nb_seances_prevues: n })
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

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        <div>
          <label style={{ ...LABEL, fontSize:11 }}>Séances prévues</label>
          <div style={{ display:'flex', gap:4 }}>
            <input style={INPUT} type="number" min="0" value={local.nb_seances_prevues} onChange={e=>set('nb_seances_prevues', e.target.value)} onBlur={()=>save()} />
            <button type="button" onClick={calculerSeances} title="Calculer à partir du calendrier"
              disabled={!c.categorie} style={{ ...BTN.small, padding:'0 8px', opacity:c.categorie?1:0.4 }}>🔄</button>
          </div>
        </div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Effectif plein tarif</label>
          <input style={INPUT} type="number" min="0" value={local.effectif_plein_prevu} onChange={e=>set('effectif_plein_prevu', e.target.value)} onBlur={()=>save()} /></div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Effectif tarif réduit</label>
          <input style={INPUT} type="number" min="0" value={local.effectif_reduit_prevu} onChange={e=>set('effectif_reduit_prevu', e.target.value)} onBlur={()=>save()} /></div>
        <div><label style={{ ...LABEL, fontSize:11 }}>Tarif annuel (€)</label>
          <input style={INPUT} type="number" min="0" step="0.01" value={local.tarif_prevu} onChange={e=>set('tarif_prevu', e.target.value)} onBlur={()=>save()} /></div>
      </div>

      <div>
        <label style={{ ...LABEL, fontSize:11 }}>Inscriptions potentielles / notes</label>
        <input style={INPUT} value={local.notes} onChange={e=>set('notes', e.target.value)} onBlur={()=>save()} placeholder="ex: Charlotte, Elodie (en attente)…" />
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

// ─── ONGLET RECETTES PAR COURS ──────────────────────────────────────
function OngletRecettes({ saison, showToast }) {
  const { cours, budgetCoursPrevisionnel, saisonsCalendrier, joursExceptionnels, sauvegarderBudgetCours, supprimerLigneBudget, sauvegarderCours } = useData()
  const [showNouveauCours, setShowNouveauCours] = useState(false)

  const bornes = useMemo(() => {
    const sc = saisonsCalendrier.find(s => s.saison === saison)
    return sc ? { date_debut: sc.date_debut, date_fin: sc.date_fin } : { date_debut: defautBornes(saison).debut, date_fin: defautBornes(saison).fin }
  }, [saisonsCalendrier, saison])

  const joursExceptionnelsSaison = useMemo(() => joursExceptionnels.filter(j => j.saison === saison), [joursExceptionnels, saison])

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
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button style={BTN.primary} onClick={()=>setShowNouveauCours(true)}>+ Nouveau cours</button>
      </div>

      <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
        Prévisionnel des recettes par cours pour la saison <strong>{saison}</strong>. Un cours qu'on ne reconduit pas : laisse simplement ses champs à zéro, pas besoin de le supprimer.
        Le bouton 🔄 calcule le nombre de séances à partir de l'onglet Calendrier (renseigne d'abord la catégorie du cours).
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
            bornes={bornes} joursExceptionnelsSaison={joursExceptionnelsSaison}
            onChange={handleChange} onRemove={()=>handleRemove(l)} onCategorieChange={handleCategorieChange} />
        ))
      )}

      {showNouveauCours && (
        <FormNouveauCours onClose={()=>setShowNouveauCours(false)}
          onCree={()=>{ setShowNouveauCours(false); showToast('Cours créé — renseigne son budget ci-dessous') }} />
      )}
    </div>
  )
}

// ─── FORMULAIRE : PÉRIODE EXCEPTIONNELLE ────────────────────────────
function FormPeriode({ saison, onClose, showToast }) {
  const { sauvegarderJourExceptionnel } = useData()
  const [form, setForm] = useState({ libelle:'', date_debut:'', date_fin:'', statut:'ferme' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.libelle.trim() || !form.date_debut || !form.date_fin) return
    setSaving(true)
    const res = await sauvegarderJourExceptionnel({ saison, ...form })
    setSaving(false)
    if (res?.error) { showToast('Erreur : ' + res.error); return }
    onClose()
  }

  return (
    <Modal titre="Nouvelle période exceptionnelle" onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={LABEL}>Libellé *</label>
          <input style={INPUT} value={form.libelle} onChange={e=>set('libelle',e.target.value)} placeholder="ex: Fermeture exceptionnelle" autoFocus />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={LABEL}>Du</label>
            <input style={INPUT} type="date" value={form.date_debut} onChange={e=>set('date_debut',e.target.value)} /></div>
          <div><label style={LABEL}>Au</label>
            <input style={INPUT} type="date" value={form.date_fin} onChange={e=>set('date_fin',e.target.value)} /></div>
        </div>
        <div>
          <label style={LABEL}>Statut</label>
          <select style={INPUT} value={form.statut} onChange={e=>set('statut',e.target.value)}>
            <option value="ferme">Fermé (aucun cours)</option>
            <option value="gym_uniquement">Gym uniquement (danse arrêtée)</option>
          </select>
        </div>
        <div style={{ display:'flex', gap:8, paddingTop:4 }}>
          <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
          <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} disabled={saving} onClick={save}>
            {saving ? 'Enregistrement…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── ONGLET CALENDRIER ANNUEL ────────────────────────────────────────
function OngletCalendrier({ saison, showToast }) {
  const { saisonsCalendrier, joursExceptionnels, sauvegarderSaisonCalendrier, sauvegarderJourExceptionnel, supprimerJourExceptionnel } = useData()
  const [showPeriode, setShowPeriode] = useState(false)
  const [generation, setGeneration] = useState(false)

  const saisonCal = saisonsCalendrier.find(s => s.saison === saison)
  const [bornes, setBornes] = useState(() => saisonCal || { date_debut: defautBornes(saison).debut, date_fin: defautBornes(saison).fin })

  const joursExceptionnelsSaison = useMemo(() =>
    joursExceptionnels.filter(j => j.saison === saison).sort((a,b) => a.date_debut.localeCompare(b.date_debut)),
    [joursExceptionnels, saison]
  )

  async function enregistrerBornes() {
    const res = await sauvegarderSaisonCalendrier(saison, bornes.date_debut, bornes.date_fin)
    if (res?.error) showToast('Erreur : ' + res.error)
    else showToast('Bornes de saison enregistrées')
  }

  async function genererJoursFeries() {
    setGeneration(true)
    const feries = joursFeriesSaison(saison)
    let nb = 0
    for (const f of feries) {
      if (statutJour(f.date, joursExceptionnelsSaison) !== 'normal') continue // déjà couvert par une période existante
      await sauvegarderJourExceptionnel({ saison, date_debut: f.date, date_fin: f.date, libelle: `Jour férié — ${f.libelle}`, statut: 'ferme' })
      nb++
    }
    setGeneration(false)
    showToast(nb > 0 ? `${nb} jour(s) férié(s) ajouté(s)` : 'Jours fériés déjà à jour')
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer cette période ?')) return
    await supprimerJourExceptionnel(id)
  }

  async function changerStatut(j, statut) {
    await sauvegarderJourExceptionnel({ ...j, statut })
  }

  const mois = moisDeSaison(saison)
  const LEGENDE = [
    { statut:'normal', label:'Normal', couleur:'#fff', bord:'rgba(0,0,0,0.1)' },
    { statut:'gym_uniquement', label:'Gym uniquement', couleur:'#CCFF0030', bord:'#aad000' },
    { statut:'ferme', label:'Fermé', couleur:'#E24B4A20', bord:'#E24B4A' },
  ]

  return (
    <div>
      <div className="card" style={{ padding:18, marginBottom:16 }}>
        <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
          Bornes de la saison (utilisées pour calculer le nombre de séances)
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div><label style={LABEL}>Début</label>
            <input style={INPUT} type="date" value={bornes.date_debut} onChange={e=>setBornes(b=>({...b, date_debut:e.target.value}))} /></div>
          <div><label style={LABEL}>Fin</label>
            <input style={INPUT} type="date" value={bornes.date_fin} onChange={e=>setBornes(b=>({...b, date_fin:e.target.value}))} /></div>
          <button style={BTN.ghost} onClick={enregistrerBornes}>Enregistrer</button>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>
          Périodes exceptionnelles ({joursExceptionnelsSaison.length})
        </p>
        <div style={{ display:'flex', gap:8 }}>
          <button style={BTN.ghost} disabled={generation} onClick={genererJoursFeries}>
            {generation ? 'Génération…' : '📅 Générer les jours fériés'}
          </button>
          <button style={BTN.primary} onClick={()=>setShowPeriode(true)}>+ Période</button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
        {joursExceptionnelsSaison.map(j => (
          <div key={j.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ flex:1, fontSize:13, fontWeight:500, minWidth:160 }}>{j.libelle}</span>
            <span style={{ fontSize:12, color:'#888' }}>{j.date_debut}{j.date_debut!==j.date_fin ? ` → ${j.date_fin}` : ''}</span>
            <select value={j.statut} onChange={e=>changerStatut(j, e.target.value)}
              style={{ fontSize:12, padding:'4px 8px', borderRadius:20, border:'none', background: j.statut==='ferme' ? '#E24B4A20' : '#CCFF0040', color: j.statut==='ferme' ? '#D85A30' : '#3a5000', fontWeight:500 }}>
              <option value="ferme">Fermé</option>
              <option value="gym_uniquement">Gym uniquement</option>
            </select>
            <button onClick={()=>supprimer(j.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:14 }}>🗑</button>
          </div>
        ))}
        {joursExceptionnelsSaison.length === 0 && <p style={{ fontSize:13, color:'#aaa', textAlign:'center', padding:16 }}>Aucune période saisie — ajoute les vacances scolaires et jours fériés.</p>}
      </div>

      <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap' }}>
        {LEGENDE.map(l => (
          <span key={l.statut} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#666' }}>
            <span style={{ width:12, height:12, borderRadius:4, background:l.couleur, border:`1px solid ${l.bord}`, display:'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
        {mois.map(({ annee, moisIndex }) => {
          const jours = joursDuMois(annee, moisIndex, joursExceptionnelsSaison)
          const decalage = (jours[0].weekday + 6) % 7 // grille lundi→dimanche
          return (
            <div key={`${annee}-${moisIndex}`} className="card" style={{ padding:12 }}>
              <p style={{ fontSize:13, fontWeight:600, margin:'0 0 8px', textAlign:'center' }}>{MOIS_FR[moisIndex]} {annee}</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, marginBottom:4 }}>
                {JOURS_COURTS.slice(1).concat(JOURS_COURTS[0]).map((j,i) => (
                  <span key={i} style={{ fontSize:9, color:'#aaa', textAlign:'center' }}>{j}</span>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
                {Array.from({ length: decalage }).map((_,i) => <span key={'d'+i} />)}
                {jours.map(j => {
                  const cfg = LEGENDE.find(l => l.statut === j.statut)
                  return (
                    <span key={j.date} title={j.date}
                      style={{ fontSize:10, textAlign:'center', padding:'3px 0', borderRadius:4, background:cfg.couleur, border:`1px solid ${cfg.bord}`, color: j.statut==='normal'?'#666':'#333' }}>
                      {j.jour}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {showPeriode && <FormPeriode saison={saison} onClose={()=>setShowPeriode(false)} showToast={showToast} />}
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────
export default function Budget() {
  const { saisonActive, budgetCoursPrevisionnel } = useData()
  const [saison, setSaison] = useState(saisonSuivante(saisonActive))
  const [onglet, setOnglet] = useState('recettes')
  const [toast, setToast] = useState(null)

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const saisonsDisponibles = useMemo(() => {
    const set = new Set([saisonActive, saisonSuivante(saisonActive), ...budgetCoursPrevisionnel.map(b=>b.saison)])
    return [...set].sort()
  }, [saisonActive, budgetCoursPrevisionnel])

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <h1 className="page-title">Budget & finances</h1>
        <select value={saison} onChange={e=>setSaison(e.target.value)}
          style={{ padding:'8px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:13, background:'#fff', color:'#666' }}>
          {saisonsDisponibles.map(s => <option key={s} value={s}>Budget {s}{s===saisonActive?' (saison active)':''}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>setOnglet('recettes')} style={{ ...BTN.ghost, ...(onglet==='recettes' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Recettes par cours</button>
        <button onClick={()=>setOnglet('calendrier')} style={{ ...BTN.ghost, ...(onglet==='calendrier' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Calendrier annuel</button>
      </div>

      {onglet === 'recettes'
        ? <OngletRecettes saison={saison} showToast={showToast} />
        : <OngletCalendrier saison={saison} showToast={showToast} />}

      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
