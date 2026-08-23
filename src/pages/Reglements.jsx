import { useState, useMemo } from 'react'
import { useData } from '../lib/store'

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
  small: { padding:'5px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', cursor:'pointer', fontSize:12 },
}
const INPUT = { width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:14, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }
const LABEL = { fontSize:12, fontWeight:500, color:'#666', marginBottom:5, display:'block' }
const PERIODICITES = ['Mensuel', 'Trimestriel', 'Semestriel', 'Annuel', 'Unique']

function Modal({ titre, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth: wide ? 720 : 520, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }
function fmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '—' }

// ─── LISTE DÉROULANTE DE BANQUES (extensible) ──────────────────────
function SelectBanque({ valeur, onChange }) {
  const { banquesConnues, ajouterBanque } = useData()

  function handleChange(e) {
    const v = e.target.value
    if (v === '__ajouter__') {
      const nom = window.prompt('Nom de la nouvelle banque :')
      if (nom && nom.trim()) {
        ajouterBanque(nom.trim())
        onChange(nom.trim())
      }
      return
    }
    onChange(v)
  }

  return (
    <select style={INPUT} value={valeur || ''} onChange={handleChange}>
      <option value="">— Choisir une banque —</option>
      {banquesConnues.map(b => <option key={b} value={b}>{b}</option>)}
      <option value="__ajouter__">+ Ajouter une nouvelle banque…</option>
    </select>
  )
}

// ─── FORMULAIRE : SAISIE GROUPÉE DE CHÈQUES ────────────────────────
function FormChequesGroupes({ onClose }) {
  const { membres, cours, creerReglementsPersonnalises } = useData()
  const [step, setStep] = useState(1) // 1 = infos générales, 2 = ajustement des lignes
  const [form, setForm] = useState({
    payeur: '', membreId: '', coursId: '', banque: '',
    premierNumero: '', nbCheques: 1, montantTotal: '',
    premiereDateEncaissement: new Date().toISOString().slice(0,10),
    periodicite: 'Mensuel', source: 'direct',
  })
  const [lignes, setLignes] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  function genererLignes() {
    const nb = Math.max(1, parseInt(form.nbCheques, 10) || 1)
    const montantParCheque = Math.round((Number(form.montantTotal) / nb) * 100) / 100
    const premierNum = parseInt(form.premierNumero, 10)
    const isNumeric = !isNaN(premierNum) && String(premierNum) === String(form.premierNumero).trim()
    const decalageMois = { Mensuel: 1, Trimestriel: 3, Semestriel: 6, Annuel: 12, Unique: 0 }[form.periodicite] || 1

    const l = Array.from({ length: nb }, (_, idx) => {
      const dateEnc = new Date(form.premiereDateEncaissement + 'T12:00:00')
      dateEnc.setMonth(dateEnc.getMonth() + idx * decalageMois)
      return {
        numero_cheque: isNumeric ? String(premierNum + idx) : `${form.premierNumero || '?'}-${idx+1}`,
        montant: montantParCheque,
        date_encaissement: dateEnc.toISOString().slice(0,10),
      }
    })
    setLignes(l)
    setStep(2)
  }

  function updateLigne(idx, key, val) {
    setLignes(prev => prev.map((l,i) => i === idx ? { ...l, [key]: val } : l))
  }

  const [erreur, setErreur] = useState(null)

  async function valider() {
    setSaving(true)
    setErreur(null)
    const res = await creerReglementsPersonnalises(lignes, {
      payeur: form.payeur, membreId: form.membreId, coursId: form.coursId, banque: form.banque,
      periodicite: form.periodicite, source: form.source,
    })
    setSaving(false)
    if (res?.error) {
      setErreur(res.error)
    } else {
      onClose()
    }
  }

  if (step === 1) {
    return (
      <Modal titre="Nouveaux chèques (remise groupée)" onClose={onClose}>
        <div style={{ display:'grid', gap:14 }}>
          <div>
            <label style={LABEL}>Nom du payeur *</label>
            <input style={INPUT} value={form.payeur} onChange={e=>set('payeur', e.target.value)} placeholder="Ex : Sophie Martin" />
          </div>
          <div>
            <label style={LABEL}>Lier à un membre (optionnel)</label>
            <select style={INPUT} value={form.membreId} onChange={e=>set('membreId', e.target.value)}>
              <option value="">— Non lié —</option>
              {membres.filter(m=>m.actif!==false).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Discipline concernée (optionnel)</label>
            <select style={INPUT} value={form.coursId} onChange={e=>set('coursId', e.target.value)}>
              <option value="">— Non précisé —</option>
              {cours.filter(c=>c.actif!==false).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LABEL}>Banque</label>
              <SelectBanque valeur={form.banque} onChange={v=>set('banque', v)} />
            </div>
            <div>
              <label style={LABEL}>Périodicité</label>
              <select style={INPUT} value={form.periodicite} onChange={e=>set('periodicite', e.target.value)}>
                {PERIODICITES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LABEL}>N° du 1er chèque</label>
              <input style={INPUT} value={form.premierNumero} onChange={e=>set('premierNumero', e.target.value)} placeholder="Ex : 1234567" />
            </div>
            <div>
              <label style={LABEL}>Nombre de chèques</label>
              <input style={INPUT} type="number" min={1} max={12} value={form.nbCheques} onChange={e=>set('nbCheques', e.target.value)} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LABEL}>Montant total réglé</label>
              <input style={INPUT} type="number" step="0.01" value={form.montantTotal} onChange={e=>set('montantTotal', e.target.value)} placeholder="Ex : 240" />
            </div>
            <div>
              <label style={LABEL}>Date du 1er encaissement</label>
              <input style={INPUT} type="date" value={form.premiereDateEncaissement} onChange={e=>set('premiereDateEncaissement', e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize:12, color:'#888', margin:0 }}>
            {form.nbCheques > 1 && form.montantTotal
              ? `${form.nbCheques} chèques de ${fmtEuros(Number(form.montantTotal)/Math.max(1,form.nbCheques))} seront générés, encaissables tous les ${form.periodicite === 'Mensuel' ? 'mois' : form.periodicite.toLowerCase()}.`
              : 'Remplis les champs pour prévisualiser les chèques.'}
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
            <button style={BTN.ghost} onClick={onClose}>Annuler</button>
            <button style={BTN.primary} disabled={!form.payeur || !form.montantTotal} onClick={genererLignes}>
              Prévisualiser les {form.nbCheques > 1 ? 'chèques' : 'le chèque'} →
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titre={`Vérifie les ${lignes.length} chèque(s)`} onClose={onClose} wide>
      <p style={{ fontSize:13, color:'#888', marginTop:-8, marginBottom:16 }}>
        Numéros, montants et dates sont modifiables avant validation.
      </p>
      <div style={{ display:'grid', gap:10 }}>
        {lignes.map((l, idx) => (
          <div key={idx} style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr 1fr', gap:10, alignItems:'center', background:'#f7f7f8', borderRadius:10, padding:'10px 12px' }}>
            <span style={{ fontSize:12, fontWeight:500, color:'#888', width:20 }}>#{idx+1}</span>
            <div>
              <label style={{ ...LABEL, fontSize:11 }}>N° chèque</label>
              <input style={{ ...INPUT, padding:'6px 10px' }} value={l.numero_cheque} onChange={e=>updateLigne(idx,'numero_cheque',e.target.value)} />
            </div>
            <div>
              <label style={{ ...LABEL, fontSize:11 }}>Montant</label>
              <input style={{ ...INPUT, padding:'6px 10px' }} type="number" step="0.01" value={l.montant} onChange={e=>updateLigne(idx,'montant',e.target.value)} />
            </div>
            <div>
              <label style={{ ...LABEL, fontSize:11 }}>Encaissement</label>
              <input style={{ ...INPUT, padding:'6px 10px' }} type="date" value={l.date_encaissement} onChange={e=>updateLigne(idx,'date_encaissement',e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20, padding:'10px 14px', background:'rgba(255,0,153,0.06)', borderRadius:10 }}>
        <span style={{ fontSize:13, color:'#666' }}>Total</span>
        <span style={{ fontSize:16, fontWeight:600, color:'#FF0099' }}>{fmtEuros(lignes.reduce((s,l)=>s+Number(l.montant||0),0))}</span>
      </div>
      {erreur && (
        <p style={{ fontSize:13, color:'#D85A30', marginTop:12, marginBottom:0 }}>⚠ {erreur} — réessaie, et si ça persiste, vérifie ta connexion ou préviens-moi.</p>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
        <button style={BTN.ghost} onClick={()=>setStep(1)}>← Retour</button>
        <button style={BTN.primary} disabled={saving} onClick={valider}>{saving ? 'Enregistrement…' : 'Valider les chèques'}</button>
      </div>
    </Modal>
  )
}

// ─── FORMULAIRE : RÈGLEMENT UNIQUE (CB / espèces / virement) ───────
function FormReglementSimple({ onClose }) {
  const { membres, cours, creerReglement } = useData()
  const [form, setForm] = useState({ payeur:'', membreId:'', coursId:'', montant:'', mode:'CB', commentaire:'', dateEncaissement: new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function valider() {
    if (!form.payeur || !form.montant) return
    setSaving(true)
    setErreur(null)
    const res = await creerReglement({
      payeur: form.payeur, membre_id: form.membreId || null, cours_id: form.coursId || null,
      montant: Number(form.montant), mode: form.mode, commentaire: form.commentaire,
      date_encaissement: form.dateEncaissement,
    })
    setSaving(false)
    if (res?.error) setErreur(res.error)
    else onClose()
  }

  return (
    <Modal titre="Nouveau règlement (CB / espèces / virement)" onClose={onClose}>
      <div style={{ display:'grid', gap:14 }}>
        <div>
          <label style={LABEL}>Nom du payeur *</label>
          <input style={INPUT} value={form.payeur} onChange={e=>set('payeur', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Lier à un membre (optionnel)</label>
          <select style={INPUT} value={form.membreId} onChange={e=>set('membreId', e.target.value)}>
            <option value="">— Non lié —</option>
            {membres.filter(m=>m.actif!==false).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL}>Discipline (optionnel)</label>
          <select style={INPUT} value={form.coursId} onChange={e=>set('coursId', e.target.value)}>
            <option value="">— Non précisé —</option>
            {cours.filter(c=>c.actif!==false).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={LABEL}>Montant *</label>
            <input style={INPUT} type="number" step="0.01" value={form.montant} onChange={e=>set('montant', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Mode</label>
            <select style={INPUT} value={form.mode} onChange={e=>set('mode', e.target.value)}>
              <option value="CB">CB (Sporizy)</option>
              <option value="Espèces">Espèces</option>
              <option value="Virement">Virement</option>
            </select>
          </div>
        </div>
        <div>
          <label style={LABEL}>Date d'encaissement</label>
          <input style={INPUT} type="date" value={form.dateEncaissement} onChange={e=>set('dateEncaissement', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Commentaire</label>
          <input style={INPUT} value={form.commentaire} onChange={e=>set('commentaire', e.target.value)} />
        </div>
        {erreur && <p style={{ fontSize:13, color:'#D85A30', margin:0 }}>⚠ {erreur}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
          <button style={BTN.ghost} onClick={onClose}>Annuler</button>
          <button style={BTN.primary} disabled={saving || !form.payeur || !form.montant} onClick={valider}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── BADGE ENDOSSEMENT ──────────────────────────────────────────────
function BadgeEndossement({ reglement }) {
  const { toggleEndossement } = useData()
  const endosse = !!reglement.endosse
  return (
    <button
      onClick={() => toggleEndossement(reglement.id, !endosse)}
      style={{
        fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer',
        background: endosse ? 'rgba(29,158,117,0.12)' : 'rgba(216,90,48,0.12)',
        color: endosse ? '#1D9E75' : '#D85A30', whiteSpace:'nowrap',
      }}
      title={endosse && reglement.date_endossement ? `Endossé le ${new Date(reglement.date_endossement).toLocaleDateString('fr-FR')}` : 'Cliquer pour marquer comme endossé'}
    >
      {endosse ? '✓ Endossé' : '⚠ Non endossé'}
    </button>
  )
}

// ─── LIGNE DE RÈGLEMENT ─────────────────────────────────────────────
function FormEditReglement({ r, onClose }) {
  const { modifierReglement } = useData()
  const [montant, setMontant] = useState(r.montant ?? '')
  const [dateEncaissement, setDateEncaissement] = useState(r.date_encaissement || '')
  const [commentaire, setCommentaire] = useState(r.commentaire || '')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function valider() {
    setSaving(true)
    setErreur(null)
    const res = await modifierReglement(r.id, {
      montant: Number(montant) || 0,
      date_encaissement: dateEncaissement || null,
      commentaire: commentaire || null,
    })
    setSaving(false)
    if (res?.error) setErreur(res.error)
    else onClose()
  }

  return (
    <div style={{ background:'#f7f7f8', borderRadius:10, padding:'10px 12px', marginTop:6, display:'grid', gap:8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ ...LABEL, fontSize:11 }}>Montant (€)</label>
          <input style={{ ...INPUT, padding:'6px 10px' }} type="number" step="0.01" value={montant} onChange={e=>setMontant(e.target.value)} />
        </div>
        <div>
          <label style={{ ...LABEL, fontSize:11 }}>Date d'encaissement</label>
          <input style={{ ...INPUT, padding:'6px 10px' }} type="date" value={dateEncaissement || ''} onChange={e=>setDateEncaissement(e.target.value)} />
        </div>
      </div>
      <div>
        <label style={{ ...LABEL, fontSize:11 }}>Note</label>
        <input style={{ ...INPUT, padding:'6px 10px' }} value={commentaire} onChange={e=>setCommentaire(e.target.value)} placeholder="Commentaire libre…" />
      </div>
      {erreur && <p style={{ fontSize:12, color:'#D85A30', margin:0 }}>⚠ {erreur}</p>}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button style={{ ...BTN.small, padding:'5px 12px' }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.small, padding:'5px 12px', background:'#FF0099', color:'#fff', border:'none' }} disabled={saving} onClick={valider}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

function LigneReglement({ r, coursNom }) {
  const { supprimerReglement } = useData()
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const isCheque = r.mode === 'Chèque'

  const detail = [
    r.mode + (isCheque && r.numero_cheque ? ` n°${r.numero_cheque}` : ''),
    r.banque,
    coursNom,
    fmtDate(r.date_encaissement),
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'8px 12px', marginBottom:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:160 }}>
          <span style={{ fontSize:13, fontWeight:500 }}>{r.payeur}</span>
          {r.echeance_total > 1 && <span style={{ fontSize:11, color:'#888', fontWeight:400 }}> · {r.echeance_num}/{r.echeance_total}</span>}
          <span style={{ fontSize:11, color:'#aaa' }}> — {detail}</span>
          {r.commentaire && <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic', marginTop:2 }}>📝 {r.commentaire}</div>}
        </div>
        <span style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap' }}>{fmtEuros(r.montant)}</span>
        {isCheque && <BadgeEndossement reglement={r} />}
        <button onClick={()=>setEditing(v=>!v)} title="Modifier"
          style={{ background:'none', border:'none', cursor:'pointer', color: editing ? '#FF0099' : '#ccc', fontSize:13, padding:'2px 4px' }}>✎</button>
        {!confirm ? (
          <button onClick={()=>setConfirm(true)} title="Supprimer"
            style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:14, padding:'2px 4px' }}>🗑</button>
        ) : (
          <span style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'#888' }}>Confirmer ?</span>
            <button style={{ ...BTN.small, padding:'3px 8px', color:'#D85A30' }} onClick={()=>supprimerReglement(r.id)}>Oui</button>
            <button style={{ ...BTN.small, padding:'3px 8px' }} onClick={()=>setConfirm(false)}>Non</button>
          </span>
        )}
      </div>
      {editing && <FormEditReglement r={r} onClose={()=>setEditing(false)} />}
    </div>
  )
}

// ─── PRÉPARATION DES REMISES DE CHÈQUES ────────────────────────────
function fmtMoisAnnee(dateStr) {
  return new Date(dateStr+'T12:00:00').toLocaleDateString('fr-FR', { month:'long', year:'numeric' })
}

// Répartit les chèques d'un mois en remises. Règle unique : une banque n'est JAMAIS re-découpée
// une fois qu'un morceau est formé (on ne scinde une banque que si elle dépasse le max à elle seule,
// en morceaux de taille max). En revanche, ces morceaux (petites banques entières ou restes de grosses
// banques) peuvent librement se mélanger entre eux pour remplir une remise au mieux.
function repartirMois(mois, chequesMois, maxParRemise, remiseExistante) {
  const parBanque = {}
  for (const c of chequesMois) {
    const b = c.banque || 'Banque non renseignée'
    if (!parBanque[b]) parBanque[b] = []
    parBanque[b].push(c)
  }
  const groupes = Object.entries(parBanque)
    .map(([banque, cheques]) => ({ banque, cheques: [...cheques].sort((a,b) => (a.payeur||'').localeCompare(b.payeur||'')) }))
    .sort((a,b) => a.banque.localeCompare(b.banque))

  // Découpe uniquement les banques qui dépassent le max, en morceaux atomiques <= max
  const morceaux = []
  for (const g of groupes) {
    if (g.cheques.length > maxParRemise) {
      for (let i = 0; i < g.cheques.length; i += maxParRemise) morceaux.push(g.cheques.slice(i, i + maxParRemise))
    } else {
      morceaux.push(g.cheques)
    }
  }

  // Remplissage "first fit" : chaque morceau va dans le premier emplacement où il tient,
  // en commençant par la remise déjà préparée (capacité limitée), sinon une nouvelle remise.
  const bins = []
  if (remiseExistante) {
    bins.push({ existant: remiseExistante, cheques: [], capacite: Math.max(0, maxParRemise - remiseExistante.nb_reglements) })
  }
  for (const morceau of morceaux) {
    let placee = false
    for (const bin of bins) {
      if (bin.cheques.length + morceau.length <= bin.capacite) {
        bin.cheques.push(...morceau)
        placee = true
        break
      }
    }
    if (!placee) bins.push({ existant: null, cheques: [...morceau], capacite: maxParRemise })
  }

  return bins.filter(b => b.cheques.length > 0).map(b => {
    const banques = [...new Set(b.cheques.map(c => c.banque || 'Banque non renseignée'))]
    return b.existant
      ? { mode:'ajout', numero: b.existant.numero, mois, banque: banques.join(', '), cheques: b.cheques }
      : { mode:'creation', banque: banques.join(', '), mois, dateRemise: mois+'-01', cheques: b.cheques }
  })
}

function FormPreparerRemise({ onClose }) {
  const { reglements, membres, remises, creerRemises, ajouterChequesRemise } = useData()
  const [type, setType] = useState('CHQ') // 'CHQ' ou 'ESP'
  const [maxParRemise, setMaxParRemise] = useState(25)
  const [saving, setSaving] = useState(false)

  const membreNomDe = (id) => membres.find(m => m.id === id)?.nom || ''

  // Chèques endossés, pas encore affectés à une remise (y compris ceux encaissables dans le futur)
  const chequesEligibles = useMemo(() => {
    if (type !== 'CHQ') return []
    return reglements.filter(r => r.mode === 'Chèque' && r.endosse && !r.numero_remise && r.date_encaissement)
  }, [reglements, type])

  // Espèces pas encore affectées à une remise (pas de notion de banque ni d'endossement)
  const especesEligibles = useMemo(() => {
    if (type !== 'ESP') return []
    return reglements.filter(r => r.mode === 'Espèces' && !r.numero_remise && r.date_encaissement)
  }, [reglements, type])

  // Regroupe uniquement par MOIS d'encaissement (le max de 20-25 s'applique toutes banques confondues,
  // pour les chèques uniquement). À l'intérieur d'une même remise, les chèques restent triés par
  // banque (en blocs) puis par payeur.
  const lots = useMemo(() => {
    if (type === 'CHQ') {
      const parMois = {}
      for (const c of chequesEligibles) {
        const mois = c.date_encaissement.slice(0, 7)
        if (!parMois[mois]) parMois[mois] = []
        parMois[mois].push(c)
      }
      const resultat = []
      for (const [mois, cheques] of Object.entries(parMois)) {
        const remiseExistante = remises.find(r => r.date_remise?.slice(0,7) === mois && r.statut === 'prepare' && r.type === 'CHQ')
        resultat.push(...repartirMois(mois, cheques, maxParRemise, remiseExistante).map(l => ({ ...l, type: 'CHQ' })))
      }
      return resultat.sort((a,b) => a.mois.localeCompare(b.mois))
    }
    // Espèces : un seul dépôt par mois, pas de limite ni de tri par banque
    const parMois = {}
    for (const c of especesEligibles) {
      const mois = c.date_encaissement.slice(0, 7)
      if (!parMois[mois]) parMois[mois] = []
      parMois[mois].push(c)
    }
    const resultat = []
    for (const [mois, especes] of Object.entries(parMois)) {
      const tries = [...especes].sort((a,b) => (a.payeur||'').localeCompare(b.payeur||''))
      const remiseExistante = remises.find(r => r.date_remise?.slice(0,7) === mois && r.statut === 'prepare' && r.type === 'ESP')
      if (remiseExistante) {
        resultat.push({ mode:'ajout', numero: remiseExistante.numero, mois, type:'ESP', banque:'Espèces', cheques: tries })
      } else {
        resultat.push({ mode:'creation', mois, dateRemise: mois+'-01', type:'ESP', banque:'Espèces', cheques: tries })
      }
    }
    return resultat.sort((a,b) => a.mois.localeCompare(b.mois))
  }, [type, chequesEligibles, especesEligibles, maxParRemise, remises])

  const eligibles = type === 'CHQ' ? chequesEligibles : especesEligibles

  async function valider() {
    if (!lots.length) return
    setSaving(true)
    const aCreer = lots.filter(l => l.mode === 'creation')
    const aAjouter = lots.filter(l => l.mode === 'ajout')
    if (aCreer.length) await creerRemises(aCreer)
    for (const l of aAjouter) await ajouterChequesRemise(l.numero, l.cheques)
    setSaving(false)
    onClose()
  }

  return (
    <Modal titre="Préparer les remises en banque" onClose={onClose} wide>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>setType('CHQ')} style={{ ...BTN.ghost, ...(type==='CHQ' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Chèques</button>
        <button onClick={()=>setType('ESP')} style={{ ...BTN.ghost, ...(type==='ESP' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Espèces</button>
      </div>

      {type === 'CHQ' && (
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
          <div>
            <label style={LABEL}>Max de chèques par remise</label>
            <input style={{ ...INPUT, width:90 }} type="number" min={1} max={50} value={maxParRemise} onChange={e=>setMaxParRemise(Number(e.target.value)||25)} />
          </div>
        </div>
      )}
      <p style={{ fontSize:12, color:'#888', marginTop:-10, marginBottom:16 }}>
        {type === 'CHQ'
          ? "Le mois de chaque remise correspond au mois d'encaissement écrit sur les chèques — toutes les remises à venir (mois futurs inclus) sont proposées en une fois. Si une remise du même mois est déjà préparée (et pas encore déposée), les nouveaux chèques viennent la compléter."
          : "Les espèces en attente sont regroupées par mois en une seule remise à déposer."}
      </p>

      {eligibles.length === 0 ? (
        <p style={{ fontSize:14, color:'#888' }}>
          {type === 'CHQ' ? "Aucun chèque endossé en attente de remise." : "Aucune espèce en attente de remise."}
        </p>
      ) : (
        <div>
          <p style={{ fontSize:13, color:'#888', marginBottom:14 }}>
            {eligibles.length} {type === 'CHQ' ? 'chèque(s)' : 'règlement(s) en espèces'} à répartir → {lots.length} lot(s) proposé(s).
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16, maxHeight:440, overflowY:'auto' }}>
            {lots.map((lot, idx) => {
              const total = lot.cheques.reduce((s,c)=>s+Number(c.montant||0),0)
              return (
                <div key={idx} style={{ background:'#f7f7f8', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                    <span style={{ fontWeight:500 }}>
                      {fmtMoisAnnee(lot.dateRemise || lot.mois+'-01')}{type==='CHQ' ? ` — ${lot.banque}` : ' — Espèces'}
                      {lot.mode === 'ajout' && (
                        <span style={{ marginLeft:8, fontSize:11, fontWeight:500, color:'#378ADD', background:'#378ADD20', borderRadius:10, padding:'2px 8px' }}>
                          + ajout à {lot.numero}
                        </span>
                      )}
                      {lot.mode === 'creation' && (
                        <span style={{ marginLeft:8, fontSize:11, fontWeight:500, color:'#1D9E75', background:'#1D9E7520', borderRadius:10, padding:'2px 8px' }}>
                          nouvelle remise
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize:13, color:'#666' }}>{lot.cheques.length} · <strong>{fmtEuros(total)}</strong></span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {lot.cheques.map(c => (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#888', padding:'2px 0' }}>
                        <span>{c.payeur || membreNomDe(c.membre_id)}{type==='CHQ' ? ` — ${c.banque || '?'} n°${c.numero_cheque}` : ''}</span>
                        <span>{fmtEuros(c.montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, padding:'10px 14px', background:'rgba(255,0,153,0.06)', borderRadius:10 }}>
            <span style={{ fontSize:13, color:'#666' }}>Total général</span>
            <span style={{ fontSize:16, fontWeight:600, color:'#FF0099' }}>{fmtEuros(eligibles.reduce((s,c)=>s+Number(c.montant||0),0))}</span>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button style={BTN.ghost} onClick={onClose}>Annuler</button>
            <button style={BTN.primary} disabled={saving} onClick={valider}>{saving ? 'Enregistrement…' : `Valider (${lots.length} lot(s))`}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── VUE REMISES (liste + détail) ───────────────────────────────────
function VueRemises() {
  const { remises, reglements, membres, modifierStatutRemise, supprimerRemise, retirerChequeRemise } = useData()
  const [ouverte, setOuverte] = useState(null)
  const membreNomDe = (id) => membres.find(m => m.id === id)?.nom || ''

  const STATUTS = { prepare: { label:'Préparée', color:'#BA7517' }, remis: { label:'Déposée en banque', color:'#378ADD' }, encaisse: { label:'Encaissée', color:'#1D9E75' } }

  if (remises.length === 0) {
    return <p style={{ fontSize:14, color:'#888', textAlign:'center', padding:30 }}>Aucune remise créée pour l'instant.</p>
  }

  async function handleSupprimer(numero) {
    if (!window.confirm(`Supprimer la remise ${numero} ? Les règlements qu'elle contient redeviendront disponibles pour une prochaine remise.`)) return
    await supprimerRemise(numero)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {remises.map(r => {
        const cheques = reglements.filter(c => c.numero_remise === r.numero).sort((a,b) => {
          const banqueA = a.banque || '', banqueB = b.banque || ''
          if (banqueA !== banqueB) return banqueA.localeCompare(banqueB)
          return (a.payeur||'').localeCompare(b.payeur||'')
        })
        const st = STATUTS[r.statut] || STATUTS.prepare
        const ouvert = ouverte === r.numero
        return (
          <div key={r.numero} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, cursor:'pointer' }} onClick={()=>setOuverte(ouvert?null:r.numero)}>
              <div>
                <p style={{ fontWeight:500, margin:'0 0 3px' }}>{r.numero}</p>
                <p style={{ fontSize:12, color:'#888', margin:0 }}>{r.nb_reglements} règlement(s) · {fmtDate(r.date_remise)}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:16, fontWeight:600 }}>{fmtEuros(r.montant_total)}</span>
                <select
                  value={r.statut}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>modifierStatutRemise(r.numero, e.target.value)}
                  style={{ fontSize:12, padding:'4px 8px', borderRadius:20, border:'none', background:st.color+'20', color:st.color, fontWeight:500 }}
                >
                  <option value="prepare">Préparée</option>
                  <option value="remis">Déposée en banque</option>
                  <option value="encaisse">Encaissée</option>
                </select>
                <button onClick={(e)=>{e.stopPropagation(); handleSupprimer(r.numero)}} title="Supprimer la remise"
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:15, padding:'2px 4px' }}>🗑</button>
              </div>
            </div>
            {ouvert && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
                {r.type === 'CHQ' && (
                  <p style={{ fontSize:11, color:'#aaa', margin:'0 0 8px' }}>Banque(s) : {r.banque}</p>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {cheques.map(c => (
                    <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#666' }}>
                      <span>{c.payeur || membreNomDe(c.membre_id)}{r.type==='CHQ' ? ` — ${c.banque || '?'} n°${c.numero_cheque}` : ''}</span>
                      <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {fmtEuros(c.montant)}
                        <button onClick={()=>retirerChequeRemise(c.id)} title="Retirer de cette remise"
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:13 }}>✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


// ─── SYNTHÈSE MENSUELLE (mode de règlement × mois d'encaissement) ──
const CELL = { padding:'8px 10px', borderBottom:'0.5px solid rgba(0,0,0,0.06)', whiteSpace:'nowrap' }
const ORDRE_MODES = ['Chèque', 'CB', 'Espèces', 'Virement', 'Autre']

function fmtMoisCourt(moisStr) {
  const [y, m] = moisStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

// Vue prévisionnelle des encaissements par mois : inclut tout ce qui a une date
// d'encaissement (chèques à venir compris), pas seulement ce qui est déjà encaissé.
function VueSynthese({ reglements, filtreSaison }) {
  const data = useMemo(() => {
    const base = reglements.filter(r => (filtreSaison === 'Toutes' || r.saison === filtreSaison) && r.date_encaissement)
    const parMoisMode = {}
    const moisSet = new Set()
    const modesSet = new Set()
    for (const r of base) {
      const mois = String(r.date_encaissement).slice(0, 7)
      const mode = r.mode || 'Autre'
      moisSet.add(mois)
      modesSet.add(mode)
      if (!parMoisMode[mois]) parMoisMode[mois] = {}
      parMoisMode[mois][mode] = (parMoisMode[mois][mode] || 0) + Number(r.montant || 0)
    }
    const mois = [...moisSet].sort()
    const modes = ORDRE_MODES.filter(m => modesSet.has(m)).concat([...modesSet].filter(m => !ORDRE_MODES.includes(m)))
    return { mois, modes, parMoisMode }
  }, [reglements, filtreSaison])

  const totalMois = (mo) => data.modes.reduce((s, mode) => s + (data.parMoisMode[mo]?.[mode] || 0), 0)
  const totalMode = (mode) => data.mois.reduce((s, mo) => s + (data.parMoisMode[mo]?.[mode] || 0), 0)
  const totalGeneral = data.mois.reduce((s, mo) => s + totalMois(mo), 0)

  if (data.mois.length === 0) {
    return <p style={{ fontSize:14, color:'#888', textAlign:'center', padding:30 }}>Aucun règlement daté pour cette période.</p>
  }

  return (
    <div>
      <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>
        Montants prévus par mois d'encaissement (chèques à venir inclus), tous statuts confondus — {filtreSaison === 'Toutes' ? 'toutes saisons' : `saison ${filtreSaison}`}.
      </p>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}>
          <thead>
            <tr>
              <th style={{ ...CELL, textAlign:'left', color:'#888', fontWeight:500 }}>Mode</th>
              {data.mois.map(mo => (
                <th key={mo} style={{ ...CELL, textAlign:'right', color:'#888', fontWeight:500, textTransform:'capitalize' }}>{fmtMoisCourt(mo)}</th>
              ))}
              <th style={{ ...CELL, textAlign:'right', fontWeight:600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.modes.map(mode => (
              <tr key={mode}>
                <td style={{ ...CELL, textAlign:'left', fontWeight:500 }}>{mode}</td>
                {data.mois.map(mo => (
                  <td key={mo} style={{ ...CELL, textAlign:'right', color: data.parMoisMode[mo]?.[mode] ? '#1a1a1a' : '#ddd' }}>
                    {data.parMoisMode[mo]?.[mode] ? fmtEuros(data.parMoisMode[mo][mode]) : '—'}
                  </td>
                ))}
                <td style={{ ...CELL, textAlign:'right', fontWeight:600 }}>{fmtEuros(totalMode(mode))}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...CELL, textAlign:'left', fontWeight:600, borderTop:'1.5px solid rgba(0,0,0,0.15)' }}>Total</td>
              {data.mois.map(mo => (
                <td key={mo} style={{ ...CELL, textAlign:'right', fontWeight:600, borderTop:'1.5px solid rgba(0,0,0,0.15)' }}>{fmtEuros(totalMois(mo))}</td>
              ))}
              <td style={{ ...CELL, textAlign:'right', fontWeight:700, color:'#FF0099', borderTop:'1.5px solid rgba(0,0,0,0.15)' }}>{fmtEuros(totalGeneral)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Reglements() {
  const { reglements, cours, saisonActive } = useData()
  const [showCheques, setShowCheques] = useState(false)
  const [showSimple, setShowSimple] = useState(false)
  const [showRemise, setShowRemise] = useState(false)
  const [ongletVue, setOngletVue] = useState('reglements') // 'reglements' | 'remises' | 'synthese'
  const [filtreMode, setFiltreMode] = useState('Tous')
  const [filtreEndossement, setFiltreEndossement] = useState('Tous')
  const [filtreSaison, setFiltreSaison] = useState(saisonActive)
  const [recherche, setRecherche] = useState('')

  const coursNomDe = (id) => cours.find(c => c.id === id)?.nom
  const saisons = useMemo(() => [...new Set(reglements.map(r => r.saison).filter(Boolean))].sort().reverse(), [reglements])

  const filtres = useMemo(() => {
    return reglements
      .filter(r => filtreSaison === 'Toutes' || r.saison === filtreSaison)
      .filter(r => filtreMode === 'Tous' || r.mode === filtreMode)
      .filter(r => filtreEndossement === 'Tous' || (filtreEndossement === 'Endossés' ? r.endosse : (r.mode === 'Chèque' && !r.endosse)))
      .filter(r => !recherche || (r.payeur||'').toLowerCase().includes(recherche.toLowerCase()))
  }, [reglements, filtreMode, filtreEndossement, filtreSaison, recherche])

  const totalAffiche = filtres.reduce((s,r) => s + Number(r.montant||0), 0)
  const nbChequesNonEndosses = reglements.filter(r => r.mode === 'Chèque' && !r.endosse && r.saison === saisonActive).length
  const nbChequesAffecter = reglements.filter(r => ((r.mode === 'Chèque' && r.endosse) || r.mode === 'Espèces') && !r.numero_remise).length

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <h1 className="page-title">Règlements</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button style={BTN.ghost} onClick={()=>setShowSimple(true)}>+ CB / espèces / virement</button>
          <button style={BTN.ghost} onClick={()=>setShowRemise(true)}>🏦 Préparer une remise{nbChequesAffecter>0 ? ` (${nbChequesAffecter})` : ''}</button>
          <button style={BTN.primary} onClick={()=>setShowCheques(true)}>+ Chèque(s)</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>setOngletVue('reglements')} style={{ ...BTN.ghost, ...(ongletVue==='reglements' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Règlements</button>
        <button onClick={()=>setOngletVue('remises')} style={{ ...BTN.ghost, ...(ongletVue==='remises' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Remises en banque</button>
        <button onClick={()=>setOngletVue('synthese')} style={{ ...BTN.ghost, ...(ongletVue==='synthese' ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>📊 Synthèse par mois</button>
      </div>

      {ongletVue === 'remises' ? (
        <VueRemises />
      ) : ongletVue === 'synthese' ? (
        <div>
          <select style={{ ...INPUT, width:'auto', fontWeight:600, marginBottom:16 }} value={filtreSaison} onChange={e=>setFiltreSaison(e.target.value)}>
            <option value="Toutes">Toutes les saisons</option>
            {saisons.map(s => <option key={s} value={s}>{s}{s===saisonActive ? ' (active)' : ''}</option>)}
          </select>
          <VueSynthese reglements={reglements} filtreSaison={filtreSaison} />
        </div>
      ) : (
      <>


      {nbChequesNonEndosses > 0 && (
        <div style={{ background:'rgba(216,90,48,0.08)', border:'0.5px solid rgba(216,90,48,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#D85A30' }}>
          ⚠ {nbChequesNonEndosses} chèque(s) non endossé(s) sur la saison {saisonActive} — pense à vérifier l'ordre et à les endosser dès réception.
        </div>
      )}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <input
          style={{ ...INPUT, width:'auto', flex:'1 1 200px' }}
          placeholder="Rechercher un payeur…"
          value={recherche}
          onChange={e=>setRecherche(e.target.value)}
        />
        <select style={{ ...INPUT, width:'auto', fontWeight:600 }} value={filtreSaison} onChange={e=>setFiltreSaison(e.target.value)}>
          <option value="Toutes">Toutes les saisons</option>
          {saisons.map(s => <option key={s} value={s}>{s}{s===saisonActive ? ' (active)' : ''}</option>)}
        </select>
        <select style={{ ...INPUT, width:'auto' }} value={filtreMode} onChange={e=>setFiltreMode(e.target.value)}>
          <option value="Tous">Tous les modes</option>
          <option value="Chèque">Chèque</option>
          <option value="CB">CB</option>
          <option value="Espèces">Espèces</option>
          <option value="Virement">Virement</option>
        </select>
        <select style={{ ...INPUT, width:'auto' }} value={filtreEndossement} onChange={e=>setFiltreEndossement(e.target.value)}>
          <option value="Tous">Endossement : tous</option>
          <option value="Endossés">Endossés</option>
          <option value="Non endossés">Non endossés (chèques)</option>
        </select>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <p style={{ fontSize:12, color:'#888', margin:0 }}>{filtres.length} règlement(s)</p>
        <p style={{ fontSize:14, fontWeight:600, margin:0 }}>{fmtEuros(totalAffiche)}</p>
      </div>

      {filtres.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p style={{ fontSize:32, marginBottom:12 }}>💶</p>
          <p style={{ fontWeight:500, marginBottom:6 }}>Aucun règlement</p>
          <p style={{ color:'#888', fontSize:14 }}>Ajoute ton premier règlement avec les boutons ci-dessus.</p>
        </div>
      ) : (
        filtres.map(r => <LigneReglement key={r.id} r={r} coursNom={coursNomDe(r.cours_id)} />)
      )}
      </>
      )}

      {showCheques && <FormChequesGroupes onClose={()=>setShowCheques(false)} />}
      {showSimple && <FormReglementSimple onClose={()=>setShowSimple(false)} />}
      {showRemise && <FormPreparerRemise onClose={()=>setShowRemise(false)} />}
    </div>
  )
}
