import { useState, useRef } from 'react'
import { useData } from '../lib/store'
import { lireFichierSportEasy, parserCotisations } from '../lib/sporteasyImport'

const BTN = {
  primary: { padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 },
  ghost: { padding:'9px 18px', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.15)', background:'transparent', color:'#666', cursor:'pointer', fontSize:14 },
}

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

export default function Inscriptions() {
  const { cours, membres, inscriptions, reglements, importerLot } = useData()
  const [fichier, setFichier] = useState(null)
  const [analyse, setAnalyse] = useState(null) // résultat du parsing + diff
  const [statut, setStatut] = useState('idle') // idle | lecture | pret | import | fait | erreur
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState(null)
  const inputRef = useRef(null)

  async function onFichierChoisi(e) {
    const f = e.target.files[0]
    if (!f) return
    setFichier(f)
    setStatut('lecture')
    setErreur(null)
    try {
      const rows = await lireFichierSportEasy(f)
      const parsed = parserCotisations(rows)

      const coursIds = new Set(cours.map(c => c.id))
      const membreIds = new Set(membres.map(m => m.id))
      const inscriptionKeys = new Set(inscriptions.map(i => `${i.membre_id}|${i.cours_id}|${i.saison}`))
      const reglementRefs = new Set(reglements.map(r => r.source_ref).filter(Boolean))

      const nouveauxCours = parsed.cours.filter(c => !coursIds.has(c.id))
      const nouveauxMembres = parsed.membres.filter(m => !membreIds.has(m.id))
      const nouvellesInscriptions = parsed.inscriptions.filter(i => !inscriptionKeys.has(`${i.membre_id}|${i.cours_id}|${i.saison}`))
      const nouveauxReglements = parsed.reglements.filter(r => !reglementRefs.has(r.source_ref))
      const montantNouveau = nouveauxReglements.reduce((s,r) => s + Number(r.montant||0), 0)

      setAnalyse({ parsed, nouveauxCours, nouveauxMembres, nouvellesInscriptions, nouveauxReglements, montantNouveau })
      setStatut('pret')
    } catch (err) {
      console.error(err)
      setErreur("Impossible de lire ce fichier. Vérifie qu'il s'agit bien d'un export SportEasy (.xlsx).")
      setStatut('erreur')
    }
  }

  async function confirmer() {
    if (!analyse) return
    setStatut('import')
    const res = await importerLot({
      cours: analyse.nouveauxCours, membres: analyse.nouveauxMembres,
      inscriptions: analyse.nouvellesInscriptions, reglements: analyse.nouveauxReglements,
    })
    if (res.error) {
      setErreur(res.error)
      setStatut('erreur')
    } else {
      setResultat(res)
      setStatut('fait')
    }
  }

  function reinitialiser() {
    setFichier(null); setAnalyse(null); setStatut('idle'); setResultat(null); setErreur(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inscriptions</h1>
      </div>

      <div className="card" style={{ padding:24, marginBottom:20 }}>
        <p style={{ fontWeight:500, marginBottom:4 }}>Importer un fichier SportEasy</p>
        <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
          Dépose le fichier export SportEasy (.xlsx) : cotisations hebdomadaires pour l'instant.
          Redépose le même fichier mis à jour autant de fois que tu veux — seules les nouvelles lignes seront ajoutées.
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

        {statut === 'pret' && analyse && (
          <div>
            <p style={{ fontSize:13, color:'#888', marginBottom:12 }}>Fichier : <strong>{fichier.name}</strong></p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
              <StatCard label="Nouveaux cours" value={analyse.nouveauxCours.length} />
              <StatCard label="Nouveaux membres" value={analyse.nouveauxMembres.length} />
              <StatCard label="Nouvelles inscriptions" value={analyse.nouvellesInscriptions.length} />
              <StatCard label="Nouveaux règlements" value={analyse.nouveauxReglements.length} sub={fmtEuros(analyse.montantNouveau)} />
            </div>

            {analyse.parsed.sansCours.length > 0 && (
              <div style={{ background:'rgba(216,90,48,0.08)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#D85A30' }}>
                ⚠ {analyse.parsed.sansCours.length} collecte(s) ignorée(s) car hors cotisation hebdo (adhésion, stage, spectacle) — à traiter avec un futur module.
              </div>
            )}

            {(analyse.nouveauxCours.length + analyse.nouveauxMembres.length + analyse.nouvellesInscriptions.length + analyse.nouveauxReglements.length) === 0 ? (
              <p style={{ fontSize:14, color:'#888' }}>Rien de nouveau dans ce fichier — tout est déjà à jour ✅</p>
            ) : (
              <div style={{ display:'flex', gap:10 }}>
                <button style={BTN.ghost} onClick={reinitialiser}>Annuler</button>
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
