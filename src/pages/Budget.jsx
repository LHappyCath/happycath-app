import { useState, useMemo, useEffect, Fragment } from 'react'
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
// Le tarif annuel n'est plus édité ici : il vient de l'onglet Tarifs (source unique),
// et se répercute automatiquement sur le calcul du CA prévu.
function LigneBudget({ cours: c, budget, saison, bornes, joursExceptionnelsSaison, onChange, onRemove, onCategorieChange }) {
  const [local, setLocal] = useState({
    nb_seances_prevues: budget?.nb_seances_prevues ?? '',
    effectif_plein_prevu: budget?.effectif_plein_prevu ?? 0,
    effectif_reduit_prevu: budget?.effectif_reduit_prevu ?? 0,
    notes: budget?.notes ?? '',
  })
  const tarif = Number(budget?.tarif_prevu ?? c.tarif_plein ?? 0)

  function set(k, v) { setLocal(l => ({ ...l, [k]: v })) }

  function save(champsEnPlus) {
    onChange({
      cours_id: c.id,
      saison,
      nb_seances_prevues: parseInt(champsEnPlus?.nb_seances_prevues ?? local.nb_seances_prevues, 10) || 0,
      effectif_plein_prevu: parseInt(local.effectif_plein_prevu, 10) || 0,
      effectif_reduit_prevu: parseInt(local.effectif_reduit_prevu, 10) || 0,
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
          <div style={{ ...INPUT, background:'#f5f5f5', color: tarif ? '#1a1a1a' : '#bbb', display:'flex', alignItems:'center' }}>
            {tarif ? fmtEuros(tarif) : '—'}
          </div>
        </div>
      </div>
      <p style={{ fontSize:10, color:'#aaa', margin:'-6px 0 10px' }}>Le tarif annuel se modifie dans l'onglet Tarifs.</p>

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

// ─── ONGLET TARIFS ───────────────────────────────────────────────────
const PERIODICITES_DECLINEES = [
  { cle: 'Semestriel', diviseur: 2, champMajoration: 'majoration_semestriel' },
  { cle: 'Trimestriel', diviseur: 3, champMajoration: 'majoration_trimestriel' },
  { cle: 'Heure', diviseur: null, champMajoration: 'majoration_heure' }, // diviseur = nb séances prévues
]

function LigneTarif({ cours: c, tarifAnnuel, nbSeancesPrevues, tarifsExistants, onMajorationChange, onMontantCalcule, onTarifAnnuelChange }) {
  const [majorations, setMajorations] = useState({
    majoration_semestriel: c.majoration_semestriel ?? 0,
    majoration_trimestriel: c.majoration_trimestriel ?? 0,
    majoration_heure: c.majoration_heure ?? 0,
  })
  const [tarifAnnuelLocal, setTarifAnnuelLocal] = useState(tarifAnnuel ?? '')

  function saveTarifAnnuel() {
    const montant = Number(tarifAnnuelLocal) || 0
    onTarifAnnuelChange(c.id, montant)
  }

  function calculerMontant(p) {
    if (!tarifAnnuel) return null
    const diviseur = p.cle === 'Heure' ? nbSeancesPrevues : p.diviseur
    if (!diviseur) return null
    const majoration = Number(majorations[p.champMajoration]) || 0
    return (tarifAnnuel / diviseur) * (1 + majoration / 100)
  }

  function handleMajorationChange(champ, valeur) {
    setMajorations(m => ({ ...m, [champ]: valeur }))
  }

  function handleBlur(p) {
    onMajorationChange(c.id, p.champMajoration, Number(majorations[p.champMajoration]) || 0)
    const montant = calculerMontant(p)
    if (montant !== null) onMontantCalcule(c.id, p.cle, montant)
  }

  return (
    <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px 14px', marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        <p style={{ fontSize:14, fontWeight:500, margin:0, flex:1, minWidth:160 }}>{c.nom}</p>
        <span style={{ fontSize:12, color:'#888' }}>{JOURS_FULL[c.jour]} {c.heure}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
        <div style={{ background:'rgba(255,0,153,0.06)', borderRadius:10, padding:'10px 12px' }}>
          <p style={{ fontSize:12, fontWeight:500, margin:'0 0 6px', color:'#FF0099' }}>Annuel</p>
          <label style={{ ...LABEL, fontSize:10 }}>Tarif (€)</label>
          <input style={INPUT} type="number" min="0" step="0.01"
            value={tarifAnnuelLocal}
            onChange={e=>setTarifAnnuelLocal(e.target.value)}
            onBlur={saveTarifAnnuel} />
          <p style={{ fontSize:10, color:'#aaa', margin:'6px 0 0' }}>Alimente le CA prévu dans Recettes par cours.</p>
        </div>
        {PERIODICITES_DECLINEES.map(p => {
          const montant = calculerMontant(p)
          const existant = tarifsExistants.find(t => t.periodicite === p.cle)
          const diviseurAffiche = p.cle === 'Heure' ? nbSeancesPrevues : p.diviseur
          return (
            <div key={p.cle} style={{ background:'#f7f7f8', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:12, fontWeight:500, margin:'0 0 6px' }}>{p.cle === 'Heure' ? 'À la séance' : p.cle}</p>
              <label style={{ ...LABEL, fontSize:10 }}>Majoration (%)</label>
              <input style={{ ...INPUT, marginBottom:6 }} type="number" step="0.1"
                value={majorations[p.champMajoration]}
                onChange={e=>handleMajorationChange(p.champMajoration, e.target.value)}
                onBlur={()=>handleBlur(p)} />
              {!diviseurAffiche && p.cle === 'Heure' && (
                <p style={{ fontSize:11, color:'#D85A30', margin:0 }}>Séances prévues manquantes (onglet Recettes)</p>
              )}
              {montant !== null && (
                <p style={{ fontSize:14, fontWeight:600, margin:0, color:'#1a1a1a' }}>{fmtEuros(montant)}</p>
              )}
              {existant && Math.round(existant.montant) !== Math.round(montant||0) && (
                <p style={{ fontSize:10, color:'#aaa', margin:'2px 0 0' }}>enregistré : {fmtEuros(existant.montant)}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OngletTarifs({ saison, showToast }) {
  const { cours, budgetCoursPrevisionnel, tarifs, sauvegarderCours, sauvegarderTarif, sauvegarderBudgetCours } = useData()

  const coursAffiches = useMemo(() => {
    const idsBudgetes = new Set(budgetCoursPrevisionnel.filter(b => b.saison === saison).map(b => b.cours_id))
    return cours
      .filter(c => c.actif !== false || idsBudgetes.has(c.id))
      .sort((a,b) => (a.jour - b.jour) || (a.heure||'').localeCompare(b.heure||''))
  }, [cours, budgetCoursPrevisionnel, saison])

  async function handleMajorationChange(coursId, champ, valeur) {
    const c = cours.find(x => x.id === coursId)
    if (!c) return
    await sauvegarderCours({ ...c, [champ]: valeur })
  }

  async function handleMontantCalcule(coursId, periodicite, montant) {
    const res = await sauvegarderTarif({ cours_id: coursId, periodicite, saison, montant: Math.round(montant * 100) / 100 })
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  // Le tarif Annuel se modifie ici : on l'enregistre à la fois comme tarif "Annuel"
  // (pour l'affichage, ex: carte du cours) et comme tarif_prevu du budget (pour le CA prévu).
  async function handleTarifAnnuelChange(coursId, montant) {
    await handleMontantCalcule(coursId, 'Annuel', montant)
    const res = await sauvegarderBudgetCours({ cours_id: coursId, saison, tarif_prevu: montant })
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  return (
    <div>
      <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
        Tarifs par cours pour la saison <strong>{saison}</strong>. Le tarif <strong>Annuel</strong> se modifie ici et alimente automatiquement le CA prévu dans "Recettes par cours". Les tarifs Semestriel / Trimestriel / à la séance sont calculés à partir de lui, avec une majoration modifiable cours par cours (0% = simple division du tarif annuel).
      </p>
      {coursAffiches.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p style={{ color:'#888', fontSize:14 }}>Aucun cours pour cette saison.</p>
        </div>
      ) : (
        coursAffiches.map(c => {
          const budget = budgetCoursPrevisionnel.find(b => b.cours_id === c.id && b.saison === saison)
          const tarifAnnuel = Number(budget?.tarif_prevu ?? c.tarif_plein ?? 0) || null
          const nbSeancesPrevues = budget?.nb_seances_prevues || null
          const tarifsExistants = tarifs.filter(t => t.cours_id === c.id && t.saison === saison)
          return (
            <LigneTarif key={c.id} cours={c} tarifAnnuel={tarifAnnuel} nbSeancesPrevues={nbSeancesPrevues}
              tarifsExistants={tarifsExistants}
              onMajorationChange={handleMajorationChange} onMontantCalcule={handleMontantCalcule}
              onTarifAnnuelChange={handleTarifAnnuelChange} />
          )
        })
      )}
    </div>
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

// ─── ONGLET MENSUEL (prévisionnel + réel, par mois) ─────────────────
const MOIS_CLES = ['aout','septembre','octobre','novembre','decembre','janvier','fevrier','mars','avril','mai','juin','juillet']
const MOIS_COURTS = ['Août','Sept','Oct','Nov','Déc','Janv','Fév','Mars','Avr','Mai','Juin','Juil']

function zerosMois() { return Object.fromEntries(MOIS_CLES.map(m => [m, 0])) }
function totalLigne(l) { return MOIS_CLES.reduce((s,m) => s + Number(l[m]||0), 0) }
function totalParMois(lignes) { return MOIS_CLES.map(m => lignes.reduce((s,l) => s + Number(l[m]||0), 0)) }

function fmtEurosSigne(n) {
  const sign = n < 0 ? '-' : ''
  return sign + fmtEuros(Math.abs(n))
}

// Formulaire pour créer une nouvelle ligne libre (recette ou charge)
function FormLigneBudget({ type, regroupements, regroupementParDefaut, initial, onClose, onCree }) {
  const [form, setForm] = useState(initial
    ? { libelle: initial.libelle, regroupement_id: initial.regroupement_id || '', entite: initial.entite || 'Asso' }
    : { regroupement_id: regroupementParDefaut || '', libelle:'', entite:'Asso' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <Modal titre={initial ? 'Modifier la ligne' : (type === 'recette' ? 'Nouvelle ligne de recette' : 'Nouvelle ligne de charge')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={LABEL}>Libellé *</label>
          <input style={INPUT} value={form.libelle} onChange={e=>set('libelle',e.target.value)} autoFocus
            placeholder={type==='recette' ? 'ex: Stages, Adhésions...' : 'ex: Loyer, Salaires...'} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={LABEL}>Regroupement Indy</label>
            <select style={INPUT} value={form.regroupement_id} onChange={e=>set('regroupement_id',e.target.value)}>
              <option value="">Non classé</option>
              {regroupements.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select></div>
          <div><label style={LABEL}>Entité</label>
            <select style={INPUT} value={form.entite} onChange={e=>set('entite',e.target.value)}>
              <option value="Asso">Asso</option>
              <option value="EI">EI</option>
            </select></div>
        </div>
        <div style={{ display:'flex', gap:8, paddingTop:4 }}>
          <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
          <button style={{ ...BTN.primary, flex:2 }} disabled={!form.libelle.trim()}
            onClick={()=>onCree({ ...form, regroupement_id: form.regroupement_id || null })}>{initial ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </Modal>
  )
}

// Une ligne éditable (mois par mois) dans un tableau prévisionnel/réel
function LigneMensuelle({ ligne, nomRegroupement, onSave, onDelete, onEdit }) {
  const [local, setLocal] = useState(() => Object.fromEntries(MOIS_CLES.map(m => [m, ligne[m] ?? 0])))
  function setMois(m, v) { setLocal(l => ({ ...l, [m]: v })) }
  function blurMois(m) {
    const val = parseFloat(local[m]) || 0
    if (val !== Number(ligne[m]||0)) onSave({ ...ligne, [m]: val })
  }
  return (
    <tr>
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:500, whiteSpace:'nowrap', position:'sticky', left:0, background:'#fff' }}>
        {ligne.libelle}
        {nomRegroupement && <span style={{ color:'#aaa', fontWeight:400 }}> · {nomRegroupement}</span>}
      </td>
      {MOIS_CLES.map(m => (
        <td key={m} style={{ padding:'2px 3px' }}>
          <input type="number" step="0.01" value={local[m]}
            onChange={e=>setMois(m, e.target.value)} onBlur={()=>blurMois(m)}
            style={{ width:64, padding:'5px 6px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:12, textAlign:'right' }} />
        </td>
      ))}
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:600, textAlign:'right', whiteSpace:'nowrap' }}>{fmtEuros(totalLigne(local))}</td>
      <td style={{ padding:'6px 4px', whiteSpace:'nowrap' }}>
        {onEdit && <button onClick={onEdit} title="Modifier le libellé / regroupement" style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:13, marginRight:4 }}>✏️</button>}
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:13 }}>🗑</button>
      </td>
    </tr>
  )
}

// Ligne éditable (mois par mois) pour la saisie d'un total de contrôle Indy
function LigneIndyTotal({ valeurs, onSave }) {
  const [local, setLocal] = useState(() => Object.fromEntries(MOIS_CLES.map(m => [m, valeurs[m] ?? 0])))
  useEffect(() => { setLocal(Object.fromEntries(MOIS_CLES.map(m => [m, valeurs[m] ?? 0]))) }, [valeurs])
  function setMois(m, v) { setLocal(l => ({ ...l, [m]: v })) }
  function blurMois(m) {
    const val = parseFloat(local[m]) || 0
    if (val !== Number(valeurs[m]||0)) onSave({ [m]: val })
  }
  return (
    <tr>
      <td style={{ padding:'6px 8px', fontSize:11, fontStyle:'italic', color:'#888', position:'sticky', left:0, background:'#fff' }}>
        Total Indy (saisie manuelle)
      </td>
      {MOIS_CLES.map(m => (
        <td key={m} style={{ padding:'2px 3px' }}>
          <input type="number" step="0.01" value={local[m]}
            onChange={e=>setMois(m, e.target.value)} onBlur={()=>blurMois(m)}
            style={{ width:64, padding:'5px 6px', borderRadius:6, border:'1px solid #378ADD50', background:'#378ADD08', fontSize:12, textAlign:'right' }} />
        </td>
      ))}
      <td style={{ padding:'6px 8px', fontSize:12, textAlign:'right', whiteSpace:'nowrap', color:'#888' }}>{fmtEuros(totalLigne(local))}</td>
      <td />
    </tr>
  )
}

// Ligne calculée (lecture seule) pour une catégorie de cours ou un cours en détail
function LigneCalculee({ libelle, valeurs, sousLigne, fort, totalAffiche }) {
  const total = totalAffiche !== undefined ? totalAffiche : valeurs.reduce((s,v)=>s+v,0)
  return (
    <tr>
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:fort?600:500, color:sousLigne?'#888':'#1a1a1a', paddingLeft:sousLigne?24:8, position:'sticky', left:0, background:'#fff' }}>
        {libelle}
      </td>
      {valeurs.map((v,i) => (
        <td key={i} style={{ padding:'6px 4px', fontSize:12, textAlign:'right', color:sousLigne?'#aaa':'#666' }}>{v ? fmtEuros(v) : '—'}</td>
      ))}
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:fort?700:600, textAlign:'right', whiteSpace:'nowrap' }}>{fmtEuros(total)}</td>
      <td />
    </tr>
  )
}

// Ligne d'écart (Indy - somme des lignes), colorée
function LigneEcart({ valeurs }) {
  return (
    <tr>
      <td style={{ padding:'6px 8px', fontSize:11, color:'#888', position:'sticky', left:0, background:'#fff' }}>Écart</td>
      {valeurs.map((v,i) => (
        <td key={i} style={{ padding:'6px 4px', fontSize:12, textAlign:'right', fontWeight:600, color: Math.abs(v)<0.01 ? '#1D9E75' : '#D85A30' }}>
          {Math.abs(v)<0.01 ? '✓' : fmtEurosSigne(v)}
        </td>
      ))}
      <td /><td />
    </tr>
  )
}

// Bloc d'un regroupement dans la vue Réel : sous-total, total Indy, écart, détail des lignes
// avecIndy=true (vue Réel) : affiche en plus le total de contrôle Indy et l'écart.
// avecIndy=false (vue Prévisionnel) : juste le sous-total du regroupement + détail.
function BlocRegroupementReel({ regroupement, nom, lignes, indyRow, avecIndy, ouvert, onToggle, onSaveIndy, onSaveLigne, onDeleteLigne, onAjouterLigne, onEditLigne }) {
  const sousTotal = totalParMois(lignes)
  const indyValeurs = MOIS_CLES.map(m => Number(indyRow?.[m] || 0))
  const ecart = sousTotal.map((v,i) => indyValeurs[i] - v)
  return (
    <>
      <tr onClick={onToggle} style={{ cursor:'pointer', background:'#f7f7f8' }}>
        <td style={{ padding:'6px 8px', fontSize:12, fontWeight:600, position:'sticky', left:0, background:'#f7f7f8' }}>
          {ouvert ? '▾' : '▸'} {nom} <span style={{ color:'#aaa', fontWeight:400 }}>({lignes.length})</span>
        </td>
        {sousTotal.map((v,i) => <td key={i} style={{ padding:'6px 4px', fontSize:12, textAlign:'right', fontWeight:600 }}>{v ? fmtEuros(v) : '—'}</td>)}
        <td style={{ padding:'6px 8px', fontSize:12, fontWeight:700, textAlign:'right' }}>{fmtEuros(sousTotal.reduce((s,v)=>s+v,0))}</td>
        <td />
      </tr>
      {ouvert && (
        <>
          {avecIndy && <LigneIndyTotal valeurs={indyRow || {}} onSave={onSaveIndy} />}
          {avecIndy && <LigneEcart valeurs={ecart} />}
          {lignes.map(l => (
            <LigneMensuelle key={l.id} ligne={l} onSave={onSaveLigne} onDelete={()=>onDeleteLigne(l)} onEdit={onEditLigne ? ()=>onEditLigne(l) : undefined} />
          ))}
          <tr>
            <td colSpan={15} style={{ padding:'4px 8px' }}>
              <button style={BTN.small} onClick={()=>onAjouterLigne(regroupement)}>+ Ligne dans "{nom}"</button>
            </td>
          </tr>
        </>
      )}
    </>
  )
}

// Ligne d'atterrissage pour un regroupement : verrouillée (réel) sur les mois clos,
// éditable (défaut = prévisionnel) sur les mois ouverts.
function LigneAtterrissage({ nom, valeursReel, valeursPrev, moisClos, override, onSave }) {
  const [local, setLocal] = useState(() => Object.fromEntries(MOIS_CLES.map((m,i) => [m, (override && override[m] != null) ? override[m] : valeursPrev[i]])))
  useEffect(() => {
    setLocal(Object.fromEntries(MOIS_CLES.map((m,i) => [m, (override && override[m] != null) ? override[m] : valeursPrev[i]])))
  }, [override, valeursPrev.join(',')])

  function setMois(m, v) { setLocal(l => ({ ...l, [m]: v })) }
  function blurMois(m) {
    const val = parseFloat(local[m])
    onSave({ [m]: isNaN(val) ? null : val })
  }

  const valeursAffichees = MOIS_CLES.map((m,i) => moisClos[m] ? valeursReel[i] : Number(local[m]) || 0)
  const total = valeursAffichees.reduce((s,v)=>s+v,0)

  return (
    <tr>
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:500, position:'sticky', left:0, background:'#fff' }}>{nom}</td>
      {MOIS_CLES.map((m,i) => moisClos[m] ? (
        <td key={m} style={{ padding:'6px 4px', fontSize:12, textAlign:'right', color:'#888' }}>{valeursReel[i] ? fmtEuros(valeursReel[i]) : '—'}</td>
      ) : (
        <td key={m} style={{ padding:'2px 3px' }}>
          <input type="number" step="0.01" value={local[m] ?? 0}
            onChange={e=>setMois(m, e.target.value)} onBlur={()=>blurMois(m)}
            style={{ width:64, padding:'5px 6px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', fontSize:12, textAlign:'right', background:'#fffbe6' }} />
        </td>
      ))}
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:600, textAlign:'right', whiteSpace:'nowrap' }}>{fmtEuros(total)}</td>
      <td />
    </tr>
  )
}

// Barre de clôture mensuelle (par saison)
function BarreCloture({ moisClos, ecartsParMois, onToggle }) {
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
      {MOIS_CLES.map((m,i) => {
        const clos = !!moisClos[m]
        const ecarts = ecartsParMois[i] || []
        return (
          <button key={m} onClick={()=>onToggle(m, !clos, ecarts)}
            title={clos ? 'Cliquer pour réouvrir' : (ecarts.length ? `Écart sur : ${ecarts.join(', ')}` : 'Cliquer pour clôturer')}
            style={{ padding:'6px 10px', borderRadius:20, border: clos ? 'none' : `1px solid ${ecarts.length ? '#D85A30' : 'rgba(0,0,0,0.15)'}`,
              background: clos ? '#1a1a1a' : '#fff', color: clos ? '#fff' : (ecarts.length ? '#D85A30' : '#666'), fontSize:12, cursor:'pointer' }}>
            {MOIS_COURTS[i]} {clos ? '🔒' : ecarts.length ? '⚠' : ''}
          </button>
        )
      })}
    </div>
  )
}

// Panneau de paramétrage des regroupements Indy
function PanneauParametres({ regroupementsIndy, onClose, showToast }) {
  const { cours, parametres, sauvegarderRegroupement, supprimerRegroupement, definirParametre } = useData()
  const [nouveau, setNouveau] = useState({ nom:'', type:'charge' })

  async function ajouter() {
    if (!nouveau.nom.trim()) return
    const res = await sauvegarderRegroupement({ nom: nouveau.nom.trim(), type: nouveau.type })
    if (res?.error) showToast('Erreur : ' + res.error)
    setNouveau({ nom:'', type:'charge' })
  }

  async function renommer(r) {
    const nom = window.prompt('Nouveau nom du regroupement', r.nom)
    if (!nom || !nom.trim() || nom.trim() === r.nom) return
    await sauvegarderRegroupement({ ...r, nom: nom.trim() })
  }

  async function supprimer(r) {
    if (!window.confirm(`Supprimer le regroupement "${r.nom}" ? Les lignes qui l'utilisent repasseront en "Non classé".`)) return
    await supprimerRegroupement(r.id)
  }

  const regroupementsRecette = regroupementsIndy.filter(r => r.type === 'recette')
  const regroupementsCharge = regroupementsIndy.filter(r => r.type === 'charge')

  const categoriesCours = [...new Set(cours.map(c => c.categorie).filter(Boolean))].sort()
  let mappingCategoriesCours = {}
  try { mappingCategoriesCours = JSON.parse(parametres.regroupements_indy_categories_cours || '{}') } catch(e) {}

  async function definirRegroupementCategorie(cat, regroupementId) {
    const nouveauMapping = { ...mappingCategoriesCours, [cat]: regroupementId || undefined }
    const nettoye = Object.fromEntries(Object.entries(nouveauMapping).filter(([,v]) => v))
    await definirParametre('regroupements_indy_categories_cours', JSON.stringify(nettoye))
  }

  return (
    <Modal titre="Paramètres — Regroupements Indy" onClose={onClose}>
      <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>
        Ces regroupements servent à répartir tes montants réels par catégorie comptable Indy. Tu peux les créer, renommer ou supprimer librement.
      </p>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <input style={{ ...INPUT, flex:1 }} value={nouveau.nom} onChange={e=>setNouveau(n=>({...n, nom:e.target.value}))} placeholder="Nom du regroupement" />
        <select style={{ ...INPUT, width:120 }} value={nouveau.type} onChange={e=>setNouveau(n=>({...n, type:e.target.value}))}>
          <option value="charge">Charge</option>
          <option value="recette">Recette</option>
        </select>
        <button style={BTN.primary} onClick={ajouter} disabled={!nouveau.nom.trim()}>+ Ajouter</button>
      </div>

      <p style={{ ...LABEL, marginTop:16 }}>Recettes</p>
      {regroupementsRecette.length === 0 && <p style={{ fontSize:12, color:'#aaa' }}>Aucun regroupement de recette.</p>}
      {regroupementsRecette.map(r => (
        <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderTop:'0.5px solid #f5f5f5' }}>
          <span style={{ flex:1, fontSize:13 }}>{r.nom}</span>
          <button style={{ ...BTN.small, fontSize:11 }} onClick={()=>renommer(r)}>Renommer</button>
          <button onClick={()=>supprimer(r)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:13 }}>🗑</button>
        </div>
      ))}

      <p style={{ ...LABEL, marginTop:16 }}>Charges</p>
      {regroupementsCharge.length === 0 && <p style={{ fontSize:12, color:'#aaa' }}>Aucun regroupement de charge.</p>}
      {regroupementsCharge.map(r => (
        <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderTop:'0.5px solid #f5f5f5' }}>
          <span style={{ flex:1, fontSize:13 }}>{r.nom}</span>
          <button style={{ ...BTN.small, fontSize:11 }} onClick={()=>renommer(r)}>Renommer</button>
          <button onClick={()=>supprimer(r)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:13 }}>🗑</button>
        </div>
      ))}

      <p style={{ ...LABEL, marginTop:16 }}>Recettes cours — regroupement Indy par catégorie</p>
      <p style={{ fontSize:11, color:'#aaa', marginBottom:8 }}>Le CA prévu de chaque catégorie de cours (Gym, Danse...) alimente le regroupement choisi ici, pour être comparable au réel.</p>
      {categoriesCours.length === 0 && <p style={{ fontSize:12, color:'#aaa' }}>Aucune catégorie de cours trouvée.</p>}
      {categoriesCours.map(cat => (
        <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderTop:'0.5px solid #f5f5f5' }}>
          <span style={{ flex:1, fontSize:13 }}>{cat}</span>
          <select style={{ ...INPUT, width:220 }} value={mappingCategoriesCours[cat] || ''} onChange={e=>definirRegroupementCategorie(cat, e.target.value)}>
            <option value="">Non classé</option>
            {regroupementsRecette.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </div>
      ))}
    </Modal>
  )
}

function EnteteTableau({ label }) {
  return (
    <thead>
      <tr>
        <th style={{ padding:'6px 8px', fontSize:11, fontWeight:500, color:'#888', textAlign:'left', position:'sticky', left:0, background:'#fff' }}>{label}</th>
        {MOIS_COURTS.map(m => <th key={m} style={{ padding:'6px 4px', fontSize:11, fontWeight:500, color:'#888' }}>{m}</th>)}
        <th style={{ padding:'6px 8px', fontSize:11, fontWeight:500, color:'#888' }}>Total</th>
        <th />
      </tr>
    </thead>
  )
}

function OngletMensuel({ saison, showToast }) {
  const {
    cours, budgetCoursPrevisionnel, budgetPrevisionnel, budgetReel, budgetRepartition,
    regroupementsIndy, budgetIndyTotaux, budgetAtterrissage, budgetMoisClos, parametres,
    sauvegarderLigneBudgetMensuel, supprimerLigneBudgetMensuel, sauvegarderRepartition,
    sauvegarderIndyTotal, sauvegarderAtterrissage, toggleMoisClos,
  } = useData()
  const [vue, setVue] = useState('previsionnel')
  const [ouvertes, setOuvertes] = useState({ Gym: false, Danse: false })
  const [modalLigne, setModalLigne] = useState(null) // { type, regroupementId } | null
  const [showParametres, setShowParametres] = useState(false)

  const table = vue === 'reel' ? 'budget_reel' : 'budget_previsionnel'
  const lignesPrevSaison = budgetPrevisionnel.filter(l => l.saison === saison)
  const lignesReelSaison = budgetReel.filter(l => l.saison === saison)
  const lignesBrutes = (vue === 'reel' ? lignesReelSaison : lignesPrevSaison)
  const lignesRecetteLibres = lignesBrutes.filter(l => l.type === 'recette')
  const lignesCharges = lignesBrutes.filter(l => l.type === 'charge')

  const mappingCategoriesCours = useMemo(() => {
    try { return JSON.parse(parametres.regroupements_indy_categories_cours || '{}') } catch(e) { return {} }
  }, [parametres.regroupements_indy_categories_cours])
  const regroupementsRecette = regroupementsIndy.filter(r => r.type === 'recette')
  const regroupementsCharge = regroupementsIndy.filter(r => r.type === 'charge')
  function nomRegroupement(id) { return id ? (regroupementsIndy.find(r => r.id === id)?.nom || 'Non classé') : 'Non classé' }

  const repartition = useMemo(() => budgetRepartition.find(r => r.saison === saison) || { saison, ...zerosMois() }, [budgetRepartition, saison])
  const [repLocal, setRepLocal] = useState(repartition)
  useEffect(() => { setRepLocal(repartition) }, [saison]) // resynchronise si on change de saison

  const totalRepartition = MOIS_CLES.reduce((s,m) => s + (Number(repLocal[m]) || 0), 0)

  // Recettes cours (Gym/Danse), calculées à partir de la Brique A + répartition
  const parCategorie = useMemo(() => {
    const groupes = { Gym: [], Danse: [] }
    for (const c of cours) {
      if (c.categorie !== 'Gym' && c.categorie !== 'Danse') continue
      const budget = budgetCoursPrevisionnel.find(b => b.cours_id === c.id && b.saison === saison)
      if (!budget) continue
      const tarif = Number(budget.tarif_prevu ?? c.tarif_plein ?? 0)
      const ca = (budget.effectif_plein_prevu||0) * tarif + (budget.effectif_reduit_prevu||0) * tarif * 0.9
      if (!ca) continue
      const valeurs = MOIS_CLES.map(m => Math.round(ca * (Number(repLocal[m])||0) / 100 * 100) / 100)
      groupes[c.categorie].push({ nom: c.nom, ca, valeurs })
    }
    return groupes
  }, [cours, budgetCoursPrevisionnel, saison, repLocal])
  const totalParCategorieCoursMois = {
    Gym: MOIS_CLES.map((_,i) => parCategorie.Gym.reduce((s,l) => s + l.valeurs[i], 0)),
    Danse: MOIS_CLES.map((_,i) => parCategorie.Danse.reduce((s,l) => s + l.valeurs[i], 0)),
  }

  async function handleSaveRepartition() {
    const res = await sauvegarderRepartition(saison, Object.fromEntries(MOIS_CLES.map(m => [m, Number(repLocal[m])||0])))
    if (res?.error) showToast('Erreur : ' + res.error)
    else showToast('Répartition enregistrée')
  }

  async function handleCreerLigne(type, regroupementId, form, initial) {
    const payload = initial ? { ...initial, ...form } : { type, saison, ...form, ...zerosMois() }
    const res = await sauvegarderLigneBudgetMensuel(table, payload)
    if (res?.error) showToast('Erreur : ' + res.error)
    setModalLigne(null)
  }

  async function handleSaveLigne(ligne) {
    const res = await sauvegarderLigneBudgetMensuel(table, ligne)
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  async function handleDeleteLigne(ligne) {
    if (!window.confirm(`Supprimer la ligne "${ligne.libelle}" ?`)) return
    const autreNom = table === 'budget_reel' ? 'Prévisionnel' : 'Réel'
    const supprimerMiroir = ligne.lien ? window.confirm(`Supprimer aussi sa ligne miroir dans ${autreNom} ?`) : false
    await supprimerLigneBudgetMensuel(table, ligne.id, supprimerMiroir)
  }

  // Totaux
  const lignesCoursValeurs = [...parCategorie.Gym, ...parCategorie.Danse].map(l => Object.fromEntries(MOIS_CLES.map((m,i) => [m, l.valeurs[i]])))
  const totalRecettesMois = vue === 'previsionnel'
    ? totalParMois([...lignesCoursValeurs, ...lignesRecetteLibres])
    : totalParMois(lignesRecetteLibres)
  const totalChargesMois = totalParMois(lignesCharges)
  const soldeMois = totalRecettesMois.map((r,i) => r - totalChargesMois[i])
  let cumul = 0
  const soldeCumule = soldeMois.map(s => (cumul += s))

  // Référence prévisionnelle d'un regroupement (somme des lignes prévisionnelles qui le
  // portent, + total cours si c'est le regroupement "Cours")
  function referencePrevisionnelle(regroupementId, type) {
    const lignes = lignesPrevSaison.filter(l => l.type === type && (l.regroupement_id || null) === regroupementId)
    let valeurs = totalParMois(lignes)
    if (type === 'recette' && regroupementId) {
      for (const cat of ['Gym', 'Danse']) {
        if (mappingCategoriesCours[cat] === regroupementId) {
          valeurs = valeurs.map((v,i) => v + totalParCategorieCoursMois[cat][i])
        }
      }
    }
    return valeurs
  }

  function lignesReelDuRegroupement(regroupementId, type) {
    return lignesReelSaison.filter(l => l.type === type && (l.regroupement_id || null) === regroupementId)
  }

  // Écart réel / prévisionnel global (indépendant du toggle d'affichage)
  const lignesRecettePrev = lignesPrevSaison.filter(l => l.type === 'recette')
  const lignesChargePrev = lignesPrevSaison.filter(l => l.type === 'charge')
  const lignesRecetteReel = lignesReelSaison.filter(l => l.type === 'recette')
  const lignesChargeReel = lignesReelSaison.filter(l => l.type === 'charge')
  const totalRecettePrev = totalParMois([...lignesCoursValeurs, ...lignesRecettePrev]).reduce((s,v)=>s+v, 0)
  const totalRecetteReel = lignesRecetteReel.reduce((s,l) => s + totalLigne(l), 0)
  const totalChargePrev = lignesChargePrev.reduce((s,l) => s + totalLigne(l), 0)
  const totalChargeReel = lignesChargeReel.reduce((s,l) => s + totalLigne(l), 0)

  // Clôture mensuelle
  const moisClos = useMemo(() => budgetMoisClos.find(m => m.saison === saison) || { saison, ...Object.fromEntries(MOIS_CLES.map(m => [m, false])) }, [budgetMoisClos, saison])

  const ecartsParMois = useMemo(() => {
    return MOIS_CLES.map(m => {
      const problemes = []
      for (const r of regroupementsIndy) {
        const indyRow = budgetIndyTotaux.find(t => t.regroupement_id === r.id && t.saison === saison)
        if (!indyRow) continue // pas encore de total Indy saisi pour ce regroupement : on ne bloque pas
        const sousTotal = lignesReelDuRegroupement(r.id, r.type).reduce((s,l) => s + Number(l[m]||0), 0)
        if (Math.abs(Number(indyRow[m]||0) - sousTotal) >= 0.01) problemes.push(r.nom)
      }
      return problemes
    })
  }, [regroupementsIndy, budgetIndyTotaux, lignesReelSaison, saison])

  async function handleToggleMois(mois, versClos, ecarts) {
    if (versClos && ecarts.length > 0) {
      window.alert(`Impossible de clôturer ${mois} : écart non nul sur ${ecarts.join(', ')}.`)
      return
    }
    if (!versClos && !window.confirm(`Réouvrir le mois de ${mois} ?`)) return
    await toggleMoisClos(saison, mois, versClos)
  }

  async function handleSaveIndyTotal(regroupementId, champ) {
    const res = await sauvegarderIndyTotal(regroupementId, saison, champ)
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  async function handleSaveAtterrissage(regroupementId, champ) {
    const res = await sauvegarderAtterrissage(regroupementId, saison, champ)
    if (res?.error) showToast('Erreur : ' + res.error)
  }

  // Atterrissage : solde global (somme des regroupements, mêlant réel verrouillé et prévisionnel ajusté)
  function valeursAtterrissage(regroupementId, type) {
    const valeursPrev = referencePrevisionnelle(regroupementId, type)
    const valeursReel = totalParMois(lignesReelDuRegroupement(regroupementId, type))
    const override = budgetAtterrissage.find(a => a.regroupement_id === regroupementId && a.saison === saison)
    return MOIS_CLES.map((m,i) => moisClos[m] ? valeursReel[i] : ((override && override[m] != null) ? Number(override[m]) : valeursPrev[i]))
  }
  const totalAtterrissageRecette = regroupementsRecette.map(r => valeursAtterrissage(r.id, 'recette'))
  const totalAtterrissageCharge = regroupementsCharge.map(r => valeursAtterrissage(r.id, 'charge'))
  const sommeAtterrissageRecette = MOIS_CLES.map((_,i) => totalAtterrissageRecette.reduce((s,v) => s + v[i], 0))
  const sommeAtterrissageCharge = MOIS_CLES.map((_,i) => totalAtterrissageCharge.reduce((s,v) => s + v[i], 0))
  const soldeAtterrissageMois = sommeAtterrissageRecette.map((r,i) => r - sommeAtterrissageCharge[i])
  let cumulAtt = 0
  const soldeAtterrissageCumule = soldeAtterrissageMois.map(s => (cumulAtt += s))

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <p style={{ fontSize:13, color:'#888', margin:0, flex:1, minWidth:260 }}>
          Budget mensuel (août → juillet) pour la saison <strong>{saison}</strong>. Les recettes Gym/Danse sont calculées automatiquement à partir de "Recettes par cours", réparties sur les mois selon la clé ci-dessous.
        </p>
        <button style={BTN.ghost} onClick={()=>setShowParametres(true)}>⚙ Regroupements Indy</button>
      </div>

      <div className="card" style={{ padding:16, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10, flexWrap:'wrap', gap:8 }}>
          <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>
            Clé de répartition mensuelle des recettes cours (%)
          </p>
          <span style={{ fontSize:12, color: Math.round(totalRepartition)===100 ? '#1D9E75' : '#D85A30' }}>
            Total : {totalRepartition.toFixed(1)}% {Math.round(totalRepartition)===100 ? '✓' : '(devrait faire 100%)'}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:8, marginBottom:10 }}>
          {MOIS_CLES.map((m,i) => (
            <div key={m}>
              <label style={{ ...LABEL, fontSize:10 }}>{MOIS_COURTS[i]}</label>
              <input type="number" step="0.1" style={INPUT} value={repLocal[m] ?? 0}
                onChange={e=>setRepLocal(r=>({...r, [m]: e.target.value}))} />
            </div>
          ))}
        </div>
        <button style={BTN.ghost} onClick={handleSaveRepartition}>Enregistrer la répartition</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button onClick={()=>setVue('previsionnel')} style={{ ...BTN.ghost, ...(vue==='previsionnel' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Prévisionnel</button>
        <button onClick={()=>setVue('reel')} style={{ ...BTN.ghost, ...(vue==='reel' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Réel</button>
        <button onClick={()=>setVue('atterrissage')} style={{ ...BTN.ghost, ...(vue==='atterrissage' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Atterrissage</button>
      </div>

      {vue === 'atterrissage' && (
        <>
          <p style={{ fontSize:12, color:'#888', marginBottom:8 }}>
            Clôture des mois : un mois clôturé verrouille l'atterrissage sur le réel. Impossible de clôturer s'il reste un écart sur un regroupement.
          </p>
          <BarreCloture moisClos={moisClos} ecartsParMois={ecartsParMois} onToggle={handleToggleMois} />
        </>
      )}

      {vue !== 'atterrissage' && (
        <div style={{ overflowX:'auto', marginBottom:16 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <EnteteTableau label="Recettes" />
            <tbody>
              {vue === 'previsionnel' && ['Gym','Danse'].map(cat => {
                const lignes = parCategorie[cat]
                const valeursCat = MOIS_CLES.map((_,i) => lignes.reduce((s,l) => s + l.valeurs[i], 0))
                if (lignes.length === 0) return null
                return (
                  <Fragment key={cat}>
                    <tr onClick={()=>setOuvertes(o=>({...o,[cat]:!o[cat]}))} style={{ cursor:'pointer', background:'#f7f7f8' }}>
                      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:600, position:'sticky', left:0, background:'#f7f7f8' }}>
                        {ouvertes[cat] ? '▾' : '▸'} {cat} <span style={{ color:'#aaa', fontWeight:400 }}>({lignes.length})</span>
                      </td>
                      {valeursCat.map((v,i) => <td key={i} style={{ padding:'6px 4px', fontSize:12, textAlign:'right', fontWeight:600 }}>{v ? fmtEuros(v) : '—'}</td>)}
                      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:700, textAlign:'right' }}>{fmtEuros(valeursCat.reduce((s,v)=>s+v,0))}</td>
                      <td />
                    </tr>
                    {ouvertes[cat] && lignes.map(l => (
                      <LigneCalculee key={l.nom} libelle={l.nom} valeurs={l.valeurs} sousLigne />
                    ))}
                  </Fragment>
                )
              })}
              {(vue === 'previsionnel' || vue === 'reel') && regroupementsRecette.map(r => (
                <BlocRegroupementReel key={r.id} regroupement={r} nom={r.nom} avecIndy={vue === 'reel'}
                  lignes={vue === 'reel' ? lignesReelDuRegroupement(r.id, 'recette') : lignesRecetteLibres.filter(l => (l.regroupement_id||null) === r.id)}
                  indyRow={vue === 'reel' ? budgetIndyTotaux.find(t => t.regroupement_id === r.id && t.saison === saison) : null}
                  ouvert={!!ouvertes['r_'+r.id]} onToggle={()=>setOuvertes(o=>({...o, ['r_'+r.id]: !o['r_'+r.id]}))}
                  onSaveIndy={(champ)=>handleSaveIndyTotal(r.id, champ)}
                  onSaveLigne={handleSaveLigne} onDeleteLigne={handleDeleteLigne}
                  onAjouterLigne={(reg)=>setModalLigne({ type:'recette', regroupementId: reg.id })}
                  onEditLigne={(l)=>setModalLigne({ type:'recette', regroupementId: l.regroupement_id, initial: l })} />
              ))}
              {lignesRecetteLibres.filter(l => !l.regroupement_id).length > 0 && (
                <BlocRegroupementReel regroupement={null} nom="Non classé" avecIndy={false}
                  lignes={lignesRecetteLibres.filter(l => !l.regroupement_id)}
                  indyRow={null}
                  ouvert={!!ouvertes['r_nonclasse']} onToggle={()=>setOuvertes(o=>({...o, r_nonclasse: !o.r_nonclasse}))}
                  onSaveIndy={()=>{}}
                  onSaveLigne={handleSaveLigne} onDeleteLigne={handleDeleteLigne}
                  onAjouterLigne={()=>setModalLigne({ type:'recette', regroupementId: null })}
                  onEditLigne={(l)=>setModalLigne({ type:'recette', regroupementId: l.regroupement_id, initial: l })} />
              )}
            </tbody>
          </table>
          {vue === 'reel' && (
            <p style={{ fontSize:11, color:'#aaa', marginTop:8 }}>Le regroupement associé à une catégorie de cours (Gym, Danse...) dans les paramètres reçoit automatiquement le CA prévu de cette catégorie comme référence.</p>
          )}
          <button style={{ ...BTN.small, marginTop:8 }} onClick={()=>setModalLigne({ type:'recette', regroupementId:null })}>+ Ligne de recette</button>
        </div>
      )}

      {vue !== 'atterrissage' && (
        <div style={{ overflowX:'auto', marginBottom:16 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <EnteteTableau label="Charges" />
            <tbody>
              {(vue === 'previsionnel' || vue === 'reel') && regroupementsCharge.map(r => (
                <BlocRegroupementReel key={r.id} regroupement={r} nom={r.nom} avecIndy={vue === 'reel'}
                  lignes={vue === 'reel' ? lignesReelDuRegroupement(r.id, 'charge') : lignesCharges.filter(l => (l.regroupement_id||null) === r.id)}
                  indyRow={vue === 'reel' ? budgetIndyTotaux.find(t => t.regroupement_id === r.id && t.saison === saison) : null}
                  ouvert={!!ouvertes['c_'+r.id]} onToggle={()=>setOuvertes(o=>({...o, ['c_'+r.id]: !o['c_'+r.id]}))}
                  onSaveIndy={(champ)=>handleSaveIndyTotal(r.id, champ)}
                  onSaveLigne={handleSaveLigne} onDeleteLigne={handleDeleteLigne}
                  onAjouterLigne={(reg)=>setModalLigne({ type:'charge', regroupementId: reg.id })}
                  onEditLigne={(l)=>setModalLigne({ type:'charge', regroupementId: l.regroupement_id, initial: l })} />
              ))}
              {lignesCharges.filter(l => !l.regroupement_id).length > 0 && (
                <BlocRegroupementReel regroupement={null} nom="Non classé" avecIndy={false}
                  lignes={lignesCharges.filter(l => !l.regroupement_id)}
                  indyRow={null}
                  ouvert={!!ouvertes['c_nonclasse']} onToggle={()=>setOuvertes(o=>({...o, c_nonclasse: !o.c_nonclasse}))}
                  onSaveIndy={()=>{}}
                  onSaveLigne={handleSaveLigne} onDeleteLigne={handleDeleteLigne}
                  onAjouterLigne={()=>setModalLigne({ type:'charge', regroupementId: null })}
                  onEditLigne={(l)=>setModalLigne({ type:'charge', regroupementId: l.regroupement_id, initial: l })} />
              )}
            </tbody>
          </table>
          <button style={{ ...BTN.small, marginTop:8 }} onClick={()=>setModalLigne({ type:'charge', regroupementId:null })}>+ Ligne de charge</button>
        </div>
      )}

      {vue === 'atterrissage' && (
        <div style={{ overflowX:'auto', marginBottom:16 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <EnteteTableau label="Recettes (atterrissage)" />
            <tbody>
              {regroupementsRecette.map(r => (
                <LigneAtterrissage key={r.id} nom={r.nom}
                  valeursReel={totalParMois(lignesReelDuRegroupement(r.id, 'recette'))}
                  valeursPrev={referencePrevisionnelle(r.id, 'recette')}
                  moisClos={moisClos}
                  override={budgetAtterrissage.find(a => a.regroupement_id === r.id && a.saison === saison)}
                  onSave={(champ)=>handleSaveAtterrissage(r.id, champ)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vue === 'atterrissage' && (
        <div style={{ overflowX:'auto', marginBottom:16 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <EnteteTableau label="Charges (atterrissage)" />
            <tbody>
              {regroupementsCharge.map(r => (
                <LigneAtterrissage key={r.id} nom={r.nom}
                  valeursReel={totalParMois(lignesReelDuRegroupement(r.id, 'charge'))}
                  valeursPrev={referencePrevisionnelle(r.id, 'charge')}
                  moisClos={moisClos}
                  override={budgetAtterrissage.find(a => a.regroupement_id === r.id && a.saison === saison)}
                  onSave={(champ)=>handleSaveAtterrissage(r.id, champ)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ overflowX:'auto', marginBottom:24 }}>
        <table style={{ borderCollapse:'collapse', width:'100%' }}>
          <EnteteTableau label="Solde" />
          <tbody>
            {vue !== 'atterrissage' ? (
              <>
                <LigneCalculee libelle="Solde du mois" valeurs={soldeMois} fort />
                <LigneCalculee libelle="Solde cumulé" valeurs={soldeCumule} fort totalAffiche={soldeCumule[soldeCumule.length-1]} />
              </>
            ) : (
              <>
                <LigneCalculee libelle="Atterrissage du mois" valeurs={soldeAtterrissageMois} fort />
                <LigneCalculee libelle="Atterrissage cumulé" valeurs={soldeAtterrissageCumule} fort totalAffiche={soldeAtterrissageCumule[soldeAtterrissageCumule.length-1]} />
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding:16 }}>
        <p style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
          Écart réel / prévisionnel — total saison
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12 }}>
          <div><p style={{ fontSize:11, color:'#888', margin:'0 0 2px' }}>Recettes prévu</p><p style={{ fontSize:15, fontWeight:600, margin:0 }}>{fmtEuros(totalRecettePrev)}</p></div>
          <div><p style={{ fontSize:11, color:'#888', margin:'0 0 2px' }}>Recettes réel</p><p style={{ fontSize:15, fontWeight:600, margin:0 }}>{fmtEuros(totalRecetteReel)}</p></div>
          <div><p style={{ fontSize:11, color:'#888', margin:'0 0 2px' }}>Charges prévu</p><p style={{ fontSize:15, fontWeight:600, margin:0 }}>{fmtEuros(totalChargePrev)}</p></div>
          <div><p style={{ fontSize:11, color:'#888', margin:'0 0 2px' }}>Charges réel</p><p style={{ fontSize:15, fontWeight:600, margin:0 }}>{fmtEuros(totalChargeReel)}</p></div>
          <div><p style={{ fontSize:11, color:'#888', margin:'0 0 2px' }}>Écart solde</p>
            <p style={{ fontSize:15, fontWeight:700, margin:0, color: (totalRecetteReel-totalChargeReel) >= (totalRecettePrev-totalChargePrev) ? '#1D9E75' : '#D85A30' }}>
              {fmtEurosSigne((totalRecetteReel-totalChargeReel) - (totalRecettePrev-totalChargePrev))}
            </p></div>
        </div>
      </div>

      {modalLigne && (
        <FormLigneBudget type={modalLigne.type}
          regroupements={modalLigne.type === 'recette' ? regroupementsRecette : regroupementsCharge}
          regroupementParDefaut={modalLigne.regroupementId}
          initial={modalLigne.initial}
          onClose={()=>setModalLigne(null)}
          onCree={(form)=>handleCreerLigne(modalLigne.type, modalLigne.regroupementId, form, modalLigne.initial)} />
      )}

      {showParametres && (
        <PanneauParametres regroupementsIndy={regroupementsIndy}
          onClose={()=>setShowParametres(false)} showToast={showToast} />
      )}
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────
export default function Budget() {
  const { saisonActive, budgetCoursPrevisionnel } = useData()
  const [saison, setSaison] = useState(saisonActive)
  const [onglet, setOnglet] = useState('calendrier')
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
        <button onClick={()=>setOnglet('calendrier')} style={{ ...BTN.ghost, ...(onglet==='calendrier' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Calendrier annuel</button>
        <button onClick={()=>setOnglet('tarifs')} style={{ ...BTN.ghost, ...(onglet==='tarifs' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Tarifs</button>
        <button onClick={()=>setOnglet('recettes')} style={{ ...BTN.ghost, ...(onglet==='recettes' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Recettes par cours</button>
        <button onClick={()=>setOnglet('mensuel')} style={{ ...BTN.ghost, ...(onglet==='mensuel' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Mensuel</button>
      </div>

      {onglet === 'recettes' && <OngletRecettes saison={saison} showToast={showToast} />}
      {onglet === 'tarifs' && <OngletTarifs saison={saison} showToast={showToast} />}
      {onglet === 'calendrier' && <OngletCalendrier saison={saison} showToast={showToast} />}
      {onglet === 'mensuel' && <OngletMensuel saison={saison} showToast={showToast} />}

      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
