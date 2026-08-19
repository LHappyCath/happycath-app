import { useState, useMemo } from 'react'
import { useData } from '../lib/store'
import { suggererMembreExistant } from '../lib/sporteasyImport'

function initiales(nom) { return (nom||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }
function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }
function fmtDate(d) { return d ? new Date(d+'T12:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }) : '—' }

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  outline: { padding:'9px 18px', borderRadius:8, border:'1px solid #FF0099', background:'transparent', color:'#FF0099', cursor:'pointer', fontSize:14 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
}
const INPUT = { width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:14, background:'#fff', color:'#1a1a1a', boxSizing:'border-box' }
const LABEL = { fontSize:12, color:'#888', display:'block', marginBottom:4 }

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

// ─── FORMULAIRE STAGE ────────────────────────────────────────────────
function FormStage({ initial, onSave, onClose }) {
  const { sauvegarderStage } = useData()
  const [form, setForm] = useState(initial || { nom:'', date_debut:'', date_fin:'', tarif:'', capacite_max:15 })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.nom.trim() || !form.date_debut || !form.date_fin) return
    setSaving(true)
    const res = await sauvegarderStage({ ...initial, ...form, tarif: Number(form.tarif)||null, capacite_max: parseInt(form.capacite_max,10)||15 })
    setSaving(false)
    if (!res?.error) onSave()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={LABEL}>Nom du stage *</label>
        <input style={INPUT} value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder="ex: Stage de Toussaint" autoFocus />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label style={LABEL}>Du *</label>
          <input style={INPUT} type="date" value={form.date_debut} onChange={e=>set('date_debut',e.target.value)} /></div>
        <div><label style={LABEL}>Au *</label>
          <input style={INPUT} type="date" value={form.date_fin} onChange={e=>set('date_fin',e.target.value)} /></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label style={LABEL}>Tarif (€)</label>
          <input style={INPUT} type="number" min="0" step="0.01" value={form.tarif} onChange={e=>set('tarif',e.target.value)} /></div>
        <div><label style={LABEL}>Places max</label>
          <input style={INPUT} type="number" min="1" value={form.capacite_max} onChange={e=>set('capacite_max',e.target.value)} /></div>
      </div>
      <div style={{ display:'flex', gap:8, paddingTop:4 }}>
        <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} disabled={saving} onClick={save}>
          {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer le stage'}
        </button>
      </div>
    </div>
  )
}

// ─── FORMULAIRE STAGIAIRE (nouveau ou recherche) ────────────────────
function FormStagiaire({ stage, onClose, onAjoute }) {
  const { membres, stagiaires, sauvegarderStagiaire, inscrireStagiaire } = useData()
  const [recherche, setRecherche] = useState('')
  const [form, setForm] = useState(null) // null = recherche en cours, objet = création
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const resultats = stagiaires.filter(s => recherche.length >= 2 && s.nom.toLowerCase().includes(recherche.toLowerCase()))
  const suggestionMembre = form ? suggererMembreExistant(form.nom, membres) : null

  async function ajouterExistant(s) {
    setSaving(true)
    await inscrireStagiaire(stage.id, s.id)
    setSaving(false)
    onAjoute()
  }

  function demarrerCreation() {
    setForm({ id: 'sg' + Date.now().toString(36), nom: recherche, telephone:'', email:'', notes:'' })
  }

  async function creerEtAjouter() {
    if (!form.nom.trim()) return
    setSaving(true)
    const res = await sauvegarderStagiaire(form)
    if (!res?.error) {
      await inscrireStagiaire(stage.id, form.id)
    }
    setSaving(false)
    onAjoute()
  }

  return (
    <Modal titre="Ajouter un stagiaire" onClose={onClose}>
      {!form ? (
        <div>
          <label style={LABEL}>Rechercher un stagiaire déjà connu</label>
          <input style={{ ...INPUT, marginBottom:12 }} value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Nom…" autoFocus />
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14, maxHeight:220, overflowY:'auto' }}>
            {resultats.map(s => (
              <div key={s.id} onClick={()=>ajouterExistant(s)} style={{ padding:'10px 12px', borderRadius:8, background:'#f7f7f8', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, flexShrink:0 }}>{initiales(s.nom)}</div>
                <span style={{ flex:1 }}>{s.nom}</span>
                <span style={{ fontSize:11, color:'#aaa' }}>+ inscrire</span>
              </div>
            ))}
            {recherche.length >= 2 && resultats.length === 0 && <p style={{ fontSize:13, color:'#aaa' }}>Aucun stagiaire connu ne correspond.</p>}
          </div>
          <button style={{ ...BTN.outline, width:'100%' }} onClick={demarrerCreation}>+ Nouveau stagiaire{recherche ? ` : "${recherche}"` : ''}</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={LABEL}>Nom complet *</label>
            <input style={INPUT} value={form.nom} onChange={e=>set('nom',e.target.value)} autoFocus />
          </div>
          {suggestionMembre && (
            <div style={{ background:'#fff8e6', border:'1px solid #f59e0b', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#92400e', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <span>Ressemble à un membre existant : <strong>{suggestionMembre.nom}</strong></span>
              <button style={{ ...BTN.ghost, padding:'4px 10px', fontSize:11 }}
                onClick={()=>setForm(f=>({...f, telephone: suggestionMembre.telephone||f.telephone, email: suggestionMembre.email||f.email}))}>
                Copier tél/email
              </button>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={LABEL}>Téléphone</label>
              <input style={INPUT} value={form.telephone} onChange={e=>set('telephone',e.target.value)} /></div>
            <div><label style={LABEL}>Email</label>
              <input style={INPUT} value={form.email} onChange={e=>set('email',e.target.value)} /></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ ...BTN.ghost, flex:1 }} onClick={()=>setForm(null)}>← Retour</button>
            <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} disabled={saving || !form.nom.trim()} onClick={creerEtAjouter}>
              {saving ? 'Enregistrement…' : 'Créer et inscrire'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── FORMULAIRE RÈGLEMENT (simple, pour un stagiaire) ───────────────
function FormReglementStage({ stage, stagiaire, onClose, onCree }) {
  const { creerReglement } = useData()
  const [form, setForm] = useState({ montant: stage.tarif || '', mode:'CB', dateEncaissement: new Date().toISOString().slice(0,10), commentaire:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function valider() {
    if (!form.montant) return
    setSaving(true)
    const res = await creerReglement({
      payeur: stagiaire.nom, stage_id: stage.id, stagiaire_id: stagiaire.id,
      montant: Number(form.montant), mode: form.mode, commentaire: form.commentaire,
      date_encaissement: form.dateEncaissement,
    })
    setSaving(false)
    if (!res?.error) onCree()
  }

  return (
    <Modal titre={`Règlement — ${stagiaire.nom}`} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={LABEL}>Montant (€) *</label>
            <input style={INPUT} type="number" step="0.01" value={form.montant} onChange={e=>set('montant',e.target.value)} /></div>
          <div><label style={LABEL}>Mode</label>
            <select style={INPUT} value={form.mode} onChange={e=>set('mode',e.target.value)}>
              <option value="CB">CB (Sporteasy)</option>
              <option value="Chèque">Chèque</option>
              <option value="Espèces">Espèces</option>
              <option value="Virement">Virement</option>
            </select></div>
        </div>
        <div><label style={LABEL}>Date d'encaissement</label>
          <input style={INPUT} type="date" value={form.dateEncaissement} onChange={e=>set('dateEncaissement',e.target.value)} /></div>
        <div><label style={LABEL}>Commentaire</label>
          <input style={INPUT} value={form.commentaire} onChange={e=>set('commentaire',e.target.value)} /></div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ ...BTN.ghost, flex:1 }} onClick={onClose}>Annuler</button>
          <button style={{ ...BTN.primary, flex:2, opacity:saving?0.7:1 }} disabled={saving || !form.montant} onClick={valider}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── ÉCRAN APPEL D'UN STAGE (jour par jour) ─────────────────────────
function EcranAppelStage({ stage, date, stagiairesInscrits, presenceExistante, onValider, onAnnuler }) {
  const [statuts, setStatuts] = useState(() => {
    const s = {}
    if (presenceExistante) {
      const presentsSet = new Set(presenceExistante.presents || [])
      stagiairesInscrits.forEach(st => { if (presentsSet.has(st.id)) s[st.id] = true })
    }
    return s
  })
  const [saving, setSaving] = useState(false)

  function cycleStatut(id) {
    setStatuts(prev => {
      const actuel = prev[id]
      if (actuel === undefined || actuel === null) return { ...prev, [id]: true }
      if (actuel === true) return { ...prev, [id]: false }
      return { ...prev, [id]: null }
    })
  }

  async function valider() {
    setSaving(true)
    const presents = Object.entries(statuts).filter(([,v]) => v === true).map(([k]) => k)
    await onValider(presents)
    setSaving(false)
  }

  const nbPresents = Object.values(statuts).filter(v => v === true).length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={onAnnuler} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:17, fontWeight:500, margin:'0 0 2px' }}>{stage.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0, textTransform:'capitalize' }}>{fmtDate(date)}</p>
        </div>
        <span style={{ fontSize:22, fontWeight:500, color:'#FF0099' }}>{nbPresents}<span style={{ fontSize:13, color:'#aaa' }}>/{stagiairesInscrits.length}</span></span>
      </div>
      <p style={{ fontSize:11, color:'#bbb', marginBottom:10 }}>Appuyer une fois = présent · deux fois = absent · trois fois = effacer</p>
      <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
        {stagiairesInscrits.map(st => {
          const statut = statuts[st.id]
          const estPresent = statut === true, estAbsent = statut === false
          const bg = estPresent ? 'rgba(255,0,153,0.05)' : estAbsent ? 'rgba(226,75,74,0.04)' : '#fff'
          const border = estPresent ? '#FF0099' : estAbsent ? '#E24B4A' : 'rgba(0,0,0,0.08)'
          return (
            <div key={st.id} onClick={()=>cycleStatut(st.id)}
              style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:estPresent?'#FF0099':estAbsent?'#E24B4A':'#f0f0f0', color:estPresent||estAbsent?'#fff':'#bbb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, flexShrink:0 }}>
                {estPresent ? '✓' : estAbsent ? '✗' : initiales(st.nom)}
              </div>
              <span style={{ flex:1, fontSize:14 }}>{st.nom}</span>
            </div>
          )
        })}
        {stagiairesInscrits.length === 0 && <p style={{ fontSize:13, color:'#aaa', padding:12 }}>Aucun stagiaire inscrit encore.</p>}
      </div>
      <button onClick={valider} disabled={saving} style={{ ...BTN.primary, width:'100%', padding:14, fontSize:16, borderRadius:12 }}>
        {saving ? 'Enregistrement…' : `✓ Valider — ${nbPresents} présent${nbPresents>1?'s':''}`}
      </button>
    </div>
  )
}

// ─── DÉTAIL D'UN STAGE ───────────────────────────────────────────────
function DetailStage({ stage, onRetour }) {
  const { stagiaires, stageInscriptions, stagePresences, reglements, online, desinscrireStagiaire, sauvegarderPresenceStage } = useData()
  const [showAjoutStagiaire, setShowAjoutStagiaire] = useState(false)
  const [showReglement, setShowReglement] = useState(null) // stagiaire ou null
  const [dateAppel, setDateAppel] = useState(null) // date choisie ou null
  const [toast, setToast] = useState(null)
  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const inscritsIds = new Set(stageInscriptions.filter(i => i.stage_id === stage.id).map(i => i.stagiaire_id))
  const stagiairesInscrits = stagiaires.filter(s => inscritsIds.has(s.id)).sort((a,b) => a.nom.localeCompare(b.nom))

  const jours = useMemo(() => {
    const arr = []
    let d = new Date(stage.date_debut + 'T12:00:00')
    const fin = new Date(stage.date_fin + 'T12:00:00')
    while (d <= fin) { arr.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1) }
    return arr
  }, [stage.date_debut, stage.date_fin])

  const presencesDuStage = stagePresences.filter(p => p.stage_id === stage.id)

  async function handleRetirer(s) {
    if (!window.confirm(`Retirer ${s.nom} de ce stage ?`)) return
    await desinscrireStagiaire(stage.id, s.id)
    showToast('Stagiaire retiré')
  }

  async function handleValiderAppel(presents) {
    const existante = presencesDuStage.find(p => p.date === dateAppel)
    await sauvegarderPresenceStage({ id: existante?.id || ('sp'+Date.now().toString(36)), stage_id: stage.id, date: dateAppel, presents })
    showToast('Présences enregistrées')
    setDateAppel(null)
  }

  if (dateAppel) {
    const existante = presencesDuStage.find(p => p.date === dateAppel)
    return <EcranAppelStage stage={stage} date={dateAppel} stagiairesInscrits={stagiairesInscrits}
      presenceExistante={existante} onValider={handleValiderAppel} onAnnuler={()=>setDateAppel(null)} />
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={onRetour} style={{ ...BTN.ghost, padding:'8px 14px', fontSize:18 }}>←</button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:'0 0 2px' }}>{stage.nom}</h2>
          <p style={{ fontSize:13, color:'#888', margin:0 }}>{fmtDate(stage.date_debut)} → {fmtDate(stage.date_fin)} · {stage.tarif ? fmtEuros(stage.tarif) : 'tarif non défini'}</p>
        </div>
      </div>

      <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Présences</p>
      <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto', paddingBottom:2 }}>
        {jours.map(j => {
          const fait = presencesDuStage.some(p => p.date === j)
          return (
            <button key={j} onClick={()=>setDateAppel(j)}
              style={{ flexShrink:0, padding:'8px 12px', borderRadius:10, border:`1.5px solid ${fait?'#aad000':'#FF0099'}`, background:fait?'rgba(204,255,0,0.1)':'transparent', color:fait?'#3a5a00':'#FF0099', cursor:'pointer', fontSize:12, textTransform:'capitalize' }}>
              {fmtDate(j)}{fait ? ' ✓' : ''}
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <p style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.07em', margin:0 }}>
          Stagiaires inscrits ({stagiairesInscrits.length}{stage.capacite_max ? ` / ${stage.capacite_max}` : ''})
        </p>
        <button style={BTN.outline} onClick={()=>setShowAjoutStagiaire(true)}>+ Ajouter</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
        {stagiairesInscrits.map(s => {
          const reglementsStagiaire = reglements.filter(r => r.stagiaire_id === s.id && r.stage_id === stage.id)
          const montantRegle = reglementsStagiaire.reduce((sum,r) => sum + Number(r.montant||0), 0)
          return (
            <div key={s.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, flexShrink:0 }}>{initiales(s.nom)}</div>
              <div style={{ flex:1, minWidth:120 }}>
                <p style={{ fontSize:13, fontWeight:500, margin:0 }}>{s.nom}</p>
                {(s.telephone || s.email) && <p style={{ fontSize:11, color:'#aaa', margin:0 }}>{s.telephone}{s.telephone && s.email ? ' · ' : ''}{s.email}</p>}
              </div>
              <span style={{ fontSize:12, color: montantRegle > 0 ? '#1D9E75' : '#D85A30' }}>
                {montantRegle > 0 ? `${fmtEuros(montantRegle)} réglé` : 'rien réglé'}
              </span>
              <button style={{ ...BTN.ghost, fontSize:12, padding:'5px 10px' }} onClick={()=>setShowReglement(s)}>+ Règlement</button>
              {online && <button onClick={()=>handleRetirer(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:14 }}>🗑</button>}
            </div>
          )
        })}
        {stagiairesInscrits.length === 0 && <p style={{ fontSize:13, color:'#aaa', textAlign:'center', padding:20 }}>Aucun stagiaire inscrit pour l'instant.</p>}
      </div>

      {showAjoutStagiaire && (
        <FormStagiaire stage={stage} onClose={()=>setShowAjoutStagiaire(false)}
          onAjoute={()=>{ setShowAjoutStagiaire(false); showToast('Stagiaire ajouté') }} />
      )}
      {showReglement && (
        <FormReglementStage stage={stage} stagiaire={showReglement} onClose={()=>setShowReglement(null)}
          onCree={()=>{ setShowReglement(null); showToast('Règlement enregistré') }} />
      )}
      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 20px', borderRadius:20, fontSize:14, fontWeight:500, zIndex:400, whiteSpace:'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────
export default function Stages() {
  const { stages, stageInscriptions, archiverStage } = useData()
  const [vue, setVue] = useState('liste')
  const [stageSelectionne, setStageSelectionne] = useState(null)
  const [modal, setModal] = useState(null)
  const [voirArchives, setVoirArchives] = useState(false)
  const [toast, setToast] = useState(null)
  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const stagesActifs = stages.filter(s => s.actif !== false).sort((a,b) => (a.date_debut||'').localeCompare(b.date_debut||''))
  const stagesArchives = stages.filter(s => s.actif === false)
  const liste = voirArchives ? stagesArchives : stagesActifs

  if (vue === 'detail' && stageSelectionne) {
    return <DetailStage stage={stageSelectionne} onRetour={()=>{ setVue('liste'); setStageSelectionne(null) }} />
  }

  async function handleArchiver(s) {
    if (!window.confirm(`Archiver le stage "${s.nom}" ?`)) return
    await archiverStage(s.id)
    showToast('Stage archivé')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stages</h1>
        <button style={BTN.primary} onClick={()=>setModal('nouveau')}>+ Nouveau stage</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>setVoirArchives(false)} style={{ ...BTN.ghost, ...(!voirArchives ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Actifs ({stagesActifs.length})</button>
        <button onClick={()=>setVoirArchives(true)} style={{ ...BTN.ghost, ...(voirArchives ? { background:'#1a1a1a', color:'#fff', border:'none' } : {}) }}>Archivés ({stagesArchives.length})</button>
      </div>

      {liste.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p style={{ fontSize:32, marginBottom:12 }}>🏕️</p>
          <p style={{ fontWeight:500, marginBottom:6 }}>Aucun stage</p>
          <p style={{ color:'#888', fontSize:14 }}>Crée un stage (Toussaint, Février, Pâques, Juillet…) pour commencer.</p>
        </div>
      ) : (
        liste.map(s => {
          const nb = stageInscriptions.filter(i => i.stage_id === s.id).length
          return (
            <div key={s.id} style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:15, fontWeight:500, margin:'0 0 3px' }}>{s.nom}</p>
                  <p style={{ fontSize:12, color:'#888', margin:'0 0 10px' }}>
                    {fmtDate(s.date_debut)} → {fmtDate(s.date_fin)} · {nb} inscrit{nb!==1?'s':''}{s.capacite_max ? ` / ${s.capacite_max}` : ''} · {s.tarif ? fmtEuros(s.tarif) : 'tarif ?'}
                  </p>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button onClick={()=>{ setStageSelectionne(s); setVue('detail') }} style={{ ...BTN.primary, fontSize:12, padding:'6px 14px' }}>Ouvrir</button>
                    {!voirArchives && <button onClick={()=>setModal(s)} style={{ ...BTN.ghost, fontSize:12, padding:'6px 12px' }}>Modifier</button>}
                    {!voirArchives && <button onClick={()=>handleArchiver(s)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#ccc', padding:'6px 8px' }}>Archiver</button>}
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}

      {modal && (
        <Modal titre={modal==='nouveau' ? 'Nouveau stage' : `Modifier — ${modal.nom}`} onClose={()=>setModal(null)}>
          <FormStage initial={modal==='nouveau'?null:modal}
            onSave={()=>{ setModal(null); showToast(modal==='nouveau'?'Stage créé !':'Stage modifié !') }}
            onClose={()=>setModal(null)} />
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
