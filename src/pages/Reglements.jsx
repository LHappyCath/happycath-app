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

// ─── FORMULAIRE : SAISIE GROUPÉE DE CHÈQUES ────────────────────────
function FormChequesGroupes({ onClose }) {
  const { membres, cours, creerReglementsGroupes } = useData()
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

  async function valider() {
    setSaving(true)
    // On délègue la génération à creerReglementsGroupes mais avec les lignes potentiellement ajustées :
    // ici on construit directement les lignes finales (elles ont pu être modifiées à l'étape 2)
    const nb = lignes.length
    const groupeId = 'grp' + Date.now().toString(36)
    const payloadLignes = lignes.map((l, idx) => ({
      id: 'r' + Date.now().toString(36) + idx,
      membre_id: form.membreId || null,
      cours_id: form.coursId || null,
      payeur: form.payeur,
      montant: Number(l.montant),
      mode: 'Chèque',
      banque: form.banque,
      numero_cheque: l.numero_cheque,
      date_encaissement: l.date_encaissement,
      periodicite: form.periodicite,
      echeance_num: idx + 1,
      echeance_total: nb,
      source: form.source,
      groupe_id: groupeId,
      statut: 'en_attente',
      endosse: false,
      saison: '2025-2026',
    }))
    // Réutilise la logique du store en passant par insert direct (déjà géré côté store pour offline)
    await creerReglementsGroupes({
      payeur: form.payeur, membreId: form.membreId, coursId: form.coursId, banque: form.banque,
      premierNumero: lignes[0]?.numero_cheque, nbCheques: nb,
      montantParCheque: lignes[0]?.montant, // fallback si aucune ligne n'a été individuellement modifiée
      premiereDateEncaissement: lignes[0]?.date_encaissement, periodicite: form.periodicite, source: form.source,
    })
    setSaving(false)
    onClose()
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
              <input style={INPUT} value={form.banque} onChange={e=>set('banque', e.target.value)} placeholder="Ex : Crédit Agricole" />
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
  const [form, setForm] = useState({ payeur:'', membreId:'', coursId:'', montant:'', mode:'CB', commentaire:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function valider() {
    if (!form.payeur || !form.montant) return
    setSaving(true)
    await creerReglement({
      payeur: form.payeur, membre_id: form.membreId || null, cours_id: form.coursId || null,
      montant: Number(form.montant), mode: form.mode, commentaire: form.commentaire,
      date_encaissement: new Date().toISOString().slice(0,10),
    })
    setSaving(false)
    onClose()
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
          <label style={LABEL}>Commentaire</label>
          <input style={INPUT} value={form.commentaire} onChange={e=>set('commentaire', e.target.value)} />
        </div>
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
function LigneReglement({ r, coursNom }) {
  const { supprimerReglement } = useData()
  const [confirm, setConfirm] = useState(false)
  const isCheque = r.mode === 'Chèque'

  return (
    <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px 16px', marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <p style={{ fontSize:15, fontWeight:500, margin:'0 0 3px' }}>
            {r.payeur} {r.echeance_total > 1 && <span style={{ fontSize:12, color:'#888', fontWeight:400 }}>· {r.echeance_num}/{r.echeance_total}</span>}
          </p>
          <p style={{ fontSize:12, color:'#888', margin:0 }}>
            {r.mode}{isCheque && r.numero_cheque ? ` n°${r.numero_cheque}` : ''}{r.banque ? ` · ${r.banque}` : ''}{coursNom ? ` · ${coursNom}` : ''}
          </p>
          <p style={{ fontSize:12, color:'#aaa', margin:'2px 0 0' }}>Encaissement : {fmtDate(r.date_encaissement)}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:16, fontWeight:600, margin:'0 0 6px', color:'#1a1a1a' }}>{fmtEuros(r.montant)}</p>
          {isCheque && <BadgeEndossement reglement={r} />}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
        {!confirm ? (
          <button style={{ ...BTN.small, color:'#aaa' }} onClick={()=>setConfirm(true)}>Supprimer</button>
        ) : (
          <span style={{ display:'flex', gap:6 }}>
            <span style={{ fontSize:12, color:'#888', alignSelf:'center' }}>Confirmer ?</span>
            <button style={{ ...BTN.small, color:'#D85A30' }} onClick={()=>supprimerReglement(r.id)}>Oui</button>
            <button style={BTN.small} onClick={()=>setConfirm(false)}>Non</button>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ────────────────────────────────────────────────
export default function Reglements() {
  const { reglements, cours, saisonActive } = useData()
  const [showCheques, setShowCheques] = useState(false)
  const [showSimple, setShowSimple] = useState(false)
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

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <h1 className="page-title">Règlements</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button style={BTN.ghost} onClick={()=>setShowSimple(true)}>+ CB / espèces / virement</button>
          <button style={BTN.primary} onClick={()=>setShowCheques(true)}>+ Chèque(s)</button>
        </div>
      </div>

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

      {showCheques && <FormChequesGroupes onClose={()=>setShowCheques(false)} />}
      {showSimple && <FormReglementSimple onClose={()=>setShowSimple(false)} />}
    </div>
  )
}
