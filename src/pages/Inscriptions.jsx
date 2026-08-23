import { useState, useRef, useMemo } from 'react'
import { useData } from '../lib/store'
import { lireFichierSportEasy, parserCotisations, suggererMembreExistant, normName } from '../lib/sporteasyImport'

// Retrouve un cours déjà existant en base à partir du cours parsé depuis SportEasy
// (nom + jour + heure), pour ne pas recréer un cours qui existe déjà sous un autre id
// (ex: un cours créé à la main dans l'écran Cours a un id différent de celui généré par l'import).
function trouverCoursExistant(coursParsed, coursExistants) {
  return coursExistants.find(c =>
    normName(c.nom) === normName(coursParsed.nom) &&
    c.jour === coursParsed.jour &&
    c.heure === coursParsed.heure
  ) || null
}

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
  small: { padding:'6px 12px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', cursor:'pointer', fontSize:12 },
}
const INPUT = { padding:'8px 12px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.2)', fontSize:14, background:'#fff', color:'#1a1a1a' }
const LS_KEY = 'happycath_saisons_import'

function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background:'#f7f7f8', borderRadius:12, padding:'14px 16px', flex:'1 1 120px' }}>
      <p style={{ fontSize:22, fontWeight:600, margin:0, color:'#1a1a1a' }}>{value}</p>
      <p style={{ fontSize:12, color:'#888', margin:'2px 0 0' }}>{label}</p>
      {sub && <p style={{ fontSize:11, color:'#aaa', margin:'2px 0 0' }}>{sub}</p>}
    </div>
  )
}

// ─── Bloc saison active / clôture ───────────────────────────────────
function BlocSaisonActive() {
  const { saisonActive, definirSaisonActive } = useData()
  const [edition, setEdition] = useState(false)
  const [valeur, setValeur] = useState(saisonActive)
  const [enCours, setEnCours] = useState(false)

  function suivante(s) {
    const [a, b] = s.split('-').map(Number)
    return `${a+1}-${b+1}`
  }

  async function valider() {
    setEnCours(true)
    await definirSaisonActive(valeur)
    setEnCours(false)
    setEdition(false)
  }

  return (
    <div className="card" style={{ padding:20, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
      <div>
        <p style={{ fontSize:12, color:'#888', margin:'0 0 2px' }}>Saison active</p>
        <p style={{ fontSize:20, fontWeight:600, margin:0, color:'#FF0099' }}>{saisonActive}</p>
        <p style={{ fontSize:12, color:'#aaa', margin:'4px 0 0' }}>Les règlements et appels affichés par défaut se limitent à cette saison.</p>
      </div>
      {!edition ? (
        <button style={BTN.ghost} onClick={()=>{setValeur(suivante(saisonActive)); setEdition(true)}}>Clôturer la saison →</button>
      ) : (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input style={INPUT} value={valeur} onChange={e=>setValeur(e.target.value)} placeholder="2027-2028" />
          <button style={BTN.ghost} onClick={()=>setEdition(false)}>Annuler</button>
          <button style={BTN.primary} disabled={enCours} onClick={valider}>{enCours?'…':`Passer en ${valeur}`}</button>
        </div>
      )}
    </div>
  )
}

export default function Inscriptions() {
  const { cours, membres, inscriptions, reglements, importerLot, saisonActive } = useData()
  const [fichier, setFichier] = useState(null)
  const [parsedBrut, setParsedBrut] = useState(null)
  const [saisonsDispo, setSaisonsDispo] = useState([])
  const [saisonsChoisies, setSaisonsChoisies] = useState([])
  const [resolutions, setResolutions] = useState({})
  const [analyse, setAnalyse] = useState(null)
  const [statut, setStatut] = useState('idle')
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState(null)
  const inputRef = useRef(null)

  async function onFichierChoisi(e) {
    const f = e.target.files[0]
    if (!f) return
    setFichier(f); setStatut('lecture'); setErreur(null)
    try {
      const rows = await lireFichierSportEasy(f)
      const parsed = parserCotisations(rows)
      setParsedBrut(parsed)

      const saisons = [...new Set(parsed.inscriptions.map(i => i.saison))].sort().reverse()
      setSaisonsDispo(saisons)
      let defaut
      try { defaut = JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { defaut = null }
      const choisies = defaut ? saisons.filter(s => defaut.includes(s)) : saisons.filter(s => s === saisonActive)
      setSaisonsChoisies(choisies.length ? choisies : saisons)
      setStatut('saisons')
    } catch (err) {
      console.error(err)
      setErreur("Impossible de lire ce fichier. Vérifie qu'il s'agit bien d'un export SportEasy (.xlsx).")
      setStatut('erreur')
    }
  }

  function toggleSaison(s) {
    setSaisonsChoisies(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])
  }

  const { nouveauxMembresBruts } = useMemo(() => {
    if (!parsedBrut || (statut !== 'saisons' && statut !== 'membres')) return { nouveauxMembresBruts: [] }
    const inscriptionsFiltrees = parsedBrut.inscriptions.filter(i => saisonsChoisies.includes(i.saison))
    const membreIdsUtilises = new Set(inscriptionsFiltrees.map(i => i.membre_id))
    const membreIdsExistants = new Set(membres.map(m => m.id))
    const nouveaux = parsedBrut.membres.filter(m => membreIdsUtilises.has(m.id) && !membreIdsExistants.has(m.id))
    return { nouveauxMembresBruts: nouveaux }
  }, [parsedBrut, saisonsChoisies, membres, statut])

  function passerAuxMembres() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(saisonsChoisies)) } catch {}
    const init = {}
    for (const m of nouveauxMembresBruts) {
      const suggestion = suggererMembreExistant(m.nom, membres)
      init[m.id] = suggestion ? suggestion.id : 'nouveau'
    }
    setResolutions(init)
    setStatut('membres')
  }

  function calculerAnalyseFinale() {
    const inscriptionsFiltrees = parsedBrut.inscriptions.filter(i => saisonsChoisies.includes(i.saison))
    const reglementsFiltres = parsedBrut.reglements.filter(r => saisonsChoisies.includes(r.saison))
    const remap = (mid) => (resolutions[mid] && resolutions[mid] !== 'nouveau') ? resolutions[mid] : mid

    // Rattache chaque cours parsé du fichier à un cours déjà existant (nom + jour + heure) :
    // si trouvé, on réutilise son id réel au lieu de l'id généré par l'import, pour ne pas
    // recréer un cours qui existe déjà.
    const remapCoursId = {}
    for (const c of parsedBrut.cours) {
      const existant = trouverCoursExistant(c, cours)
      if (existant) remapCoursId[c.id] = existant.id
    }
    const remapCours = (cid) => remapCoursId[cid] || cid

    const inscriptionsFinales = inscriptionsFiltrees.map(i => ({ ...i, membre_id: remap(i.membre_id), cours_id: remapCours(i.cours_id) }))
    const reglementsFinaux = reglementsFiltres.map(r => ({ ...r, membre_id: remap(r.membre_id), cours_id: remapCours(r.cours_id) }))
    const membresFinaux = parsedBrut.membres.filter(m => {
      const utilise = inscriptionsFinales.some(i => i.membre_id === m.id)
      const resolutionEstNouveau = !Object.prototype.hasOwnProperty.call(resolutions, m.id) || resolutions[m.id] === 'nouveau'
      return utilise && resolutionEstNouveau
    })
    const coursIdsUtilises = new Set(inscriptionsFinales.map(i => i.cours_id))
    const coursFinaux = parsedBrut.cours
      .map(c => ({ ...c, id: remapCours(c.id) }))
      .filter(c => coursIdsUtilises.has(c.id))

    const coursIds = new Set(cours.map(c => c.id))
    const membreIds = new Set(membres.map(m => m.id))
    const inscriptionKeys = new Set(inscriptions.map(i => `${i.membre_id}|${i.cours_id}|${i.saison}`))
    const reglementRefs = new Set(reglements.map(r => r.source_ref).filter(Boolean))

    const nouveauxCours = coursFinaux.filter(c => !coursIds.has(c.id))
    const nouveauxMembres = membresFinaux.filter(m => !membreIds.has(m.id))
    const nouvellesInscriptions = inscriptionsFinales.filter(i => !inscriptionKeys.has(`${i.membre_id}|${i.cours_id}|${i.saison}`))
    const nouveauxReglements = reglementsFinaux.filter(r => !reglementRefs.has(r.source_ref))
    const montantNouveau = nouveauxReglements.reduce((s,r) => s + Number(r.montant||0), 0)
    const nbLiaisons = Object.values(resolutions).filter(v => v !== 'nouveau').length

    setAnalyse({ nouveauxCours, nouveauxMembres, nouvellesInscriptions, nouveauxReglements, montantNouveau, nbLiaisons })
    setStatut('pret')
  }

  async function confirmer() {
    setStatut('import')
    const res = await importerLot({
      cours: analyse.nouveauxCours, membres: analyse.nouveauxMembres,
      inscriptions: analyse.nouvellesInscriptions, reglements: analyse.nouveauxReglements,
    })
    if (res.error) { setErreur(res.error); setStatut('erreur') }
    else { setResultat(res); setStatut('fait') }
  }

  function reinitialiser() {
    setFichier(null); setParsedBrut(null); setAnalyse(null); setStatut('idle')
    setResultat(null); setErreur(null); setResolutions({})
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Inscriptions</h1></div>

      <BlocSaisonActive />

      <div className="card" style={{ padding:24, marginBottom:20 }}>
        <p style={{ fontWeight:500, marginBottom:4 }}>Importer un fichier SportEasy</p>
        <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
          Cotisations hebdomadaires pour l'instant. Redépose le même fichier mis à jour autant de fois que tu veux.
        </p>

        {statut === 'idle' && (
          <label style={{ display:'inline-block' }}>
            <input ref={inputRef} type="file" accept=".xlsx" onChange={onFichierChoisi} style={{ display:'none' }} />
            <span style={BTN.primary}>📂 Choisir un fichier .xlsx</span>
          </label>
        )}

        {statut === 'lecture' && <p style={{ color:'#888', fontSize:14 }}>Lecture de {fichier?.name}…</p>}

        {statut === 'erreur' && (
          <div>
            <p style={{ color:'#D85A30', fontSize:14, marginBottom:12 }}>⚠ {erreur}</p>
            <button style={BTN.ghost} onClick={reinitialiser}>Réessayer</button>
          </div>
        )}

        {statut === 'saisons' && (
          <div>
            <p style={{ fontSize:13, color:'#888', marginBottom:12 }}>Fichier : <strong>{fichier.name}</strong></p>
            <p style={{ fontSize:14, fontWeight:500, marginBottom:10 }}>Quelles saisons veux-tu traiter dans ce fichier ?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {saisonsDispo.map(s => {
                const n = parsedBrut.inscriptions.filter(i=>i.saison===s).length
                return (
                  <label key={s} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f7f7f8', borderRadius:10, cursor:'pointer' }}>
                    <input type="checkbox" checked={saisonsChoisies.includes(s)} onChange={()=>toggleSaison(s)} />
                    <span style={{ fontWeight:500 }}>{s}</span>
                    {s === saisonActive && <span style={{ fontSize:11, color:'#FF0099' }}>(active)</span>}
                    <span style={{ fontSize:12, color:'#888', marginLeft:'auto' }}>{n} inscription(s)</span>
                  </label>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button style={BTN.ghost} onClick={reinitialiser}>Annuler</button>
              <button style={BTN.primary} disabled={!saisonsChoisies.length} onClick={passerAuxMembres}>
                Continuer ({nouveauxMembresBruts.length} nouveau(x) nom(s) à vérifier) →
              </button>
            </div>
          </div>
        )}

        {statut === 'membres' && (
          <div>
            {nouveauxMembresBruts.length === 0 ? (
              <div>
                <p style={{ fontSize:14, color:'#888', marginBottom:16 }}>Aucun nouveau nom dans les saisons choisies — tout correspond déjà à des membres existants.</p>
                <button style={BTN.primary} onClick={calculerAnalyseFinale}>Continuer →</button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Vérifie chaque nouveau nom ({nouveauxMembresBruts.length})</p>
                <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>Pour chacun : c'est un membre déjà existant, ou une vraie nouvelle personne ?</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16, maxHeight:420, overflowY:'auto' }}>
                  {nouveauxMembresBruts.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f7f7f8', borderRadius:10, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:500, minWidth:180 }}>{m.nom}</span>
                      <select
                        style={{ ...INPUT, padding:'6px 10px', flex:1, minWidth:220 }}
                        value={resolutions[m.id] || 'nouveau'}
                        onChange={e => setResolutions(prev => ({ ...prev, [m.id]: e.target.value }))}
                      >
                        <option value="nouveau">➕ Créer comme nouveau membre</option>
                        {membres.map(mx => <option key={mx.id} value={mx.id}>🔗 Lier à : {mx.nom}</option>)}
                      </select>
                      {resolutions[m.id] && resolutions[m.id] !== 'nouveau' && (
                        <span style={{ fontSize:11, color:'#1D9E75' }}>suggestion</span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button style={BTN.ghost} onClick={()=>setStatut('saisons')}>← Retour</button>
                  <button style={BTN.primary} onClick={calculerAnalyseFinale}>Valider ces choix →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {statut === 'pret' && analyse && (
          <div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
              <StatCard label="Nouveaux cours" value={analyse.nouveauxCours.length} />
              <StatCard label="Nouveaux membres" value={analyse.nouveauxMembres.length} sub={analyse.nbLiaisons ? `+ ${analyse.nbLiaisons} lié(s) à l'existant` : null} />
              <StatCard label="Nouvelles inscriptions" value={analyse.nouvellesInscriptions.length} />
              <StatCard label="Nouveaux règlements" value={analyse.nouveauxReglements.length} sub={fmtEuros(analyse.montantNouveau)} />
            </div>
            {(analyse.nouveauxCours.length + analyse.nouveauxMembres.length + analyse.nouvellesInscriptions.length + analyse.nouveauxReglements.length) === 0 ? (
              <p style={{ fontSize:14, color:'#888' }}>Rien de nouveau à importer — tout est déjà à jour ✅</p>
            ) : (
              <div style={{ display:'flex', gap:10 }}>
                <button style={BTN.ghost} onClick={()=>setStatut('membres')}>← Retour</button>
                <button style={BTN.primary} onClick={confirmer}>Valider l'import</button>
              </div>
            )}
          </div>
        )}

        {statut === 'import' && <p style={{ color:'#888', fontSize:14 }}>Import en cours…</p>}

        {statut === 'fait' && resultat && (
          <div>
            <p style={{ fontSize:14, color:'#1D9E75', fontWeight:500, marginBottom:12 }}>
              ✓ Import terminé : {resultat.nbCours} cours, {resultat.nbMembres} membres, {resultat.nbInscriptions} inscriptions, {resultat.nbReglements} règlements ajoutés.
            </p>
            <button style={BTN.ghost} onClick={reinitialiser}>Importer un autre fichier</button>
          </div>
        )}
      </div>
    </div>
  )
}
