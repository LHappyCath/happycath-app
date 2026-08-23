import { useMemo } from 'react'
import { useData } from '../lib/store'
import { calculerEvolutionBudget, GraphiqueBarresComparaison, GraphiqueEvolution, MOIS_COURTS } from './Budget'

const LABEL = { fontSize:12, fontWeight:500, color:'#666', marginBottom:5, display:'block' }
function fmtEuros(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €' }
function couleurSolde(v) { return v >= 0 ? '#1D9E75' : '#D85A30' }

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ padding:'16px 18px', flex:'1 1 220px' }}>
      <p style={{ fontSize:12, color:'#888', margin:'0 0 6px' }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:600, margin:0, color: couleurSolde(value) }}>{fmtEuros(value)}</p>
      {sub && <p style={{ fontSize:11, color:'#aaa', margin:'4px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function Resultats() {
  const {
    saisonActive, cours, budgetCoursPrevisionnel, budgetRepartition, budgetPrevisionnel, budgetReel,
    budgetAutresRecettes, regroupementsIndy, budgetAtterrissageLignes, budgetMoisClos, budgetSoldeInitial, parametres,
  } = useData()

  const donnees = useMemo(() => calculerEvolutionBudget(saisonActive, {
    cours, budgetCoursPrevisionnel, budgetRepartition, budgetPrevisionnel, budgetReel,
    budgetAutresRecettes, regroupementsIndy, budgetAtterrissageLignes, budgetMoisClos, budgetSoldeInitial, parametres,
  }), [saisonActive, cours, budgetCoursPrevisionnel, budgetRepartition, budgetPrevisionnel, budgetReel,
    budgetAutresRecettes, regroupementsIndy, budgetAtterrissageLignes, budgetMoisClos, budgetSoldeInitial, parametres])

  const { soldePrevCumule, soldeReelCumule, soldeAtterrissageCumule, dernierMoisAvecReel } = donnees
  const resultatReel = dernierMoisAvecReel >= 0 ? soldeReelCumule[dernierMoisAvecReel] : 0
  const atterrissageTotal = soldeAtterrissageCumule[soldeAtterrissageCumule.length - 1]
  const resultatBudgetTotal = soldePrevCumule[soldePrevCumule.length - 1]

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Résultats</h1></div>
      <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>
        Vue d'ensemble du budget pour la saison <strong>{saisonActive}</strong>.
      </p>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        <StatCard
          label={dernierMoisAvecReel >= 0 ? `Résultat réel (cumul à ${MOIS_COURTS[dernierMoisAvecReel]})` : 'Résultat réel'}
          value={resultatReel}
          sub={dernierMoisAvecReel < 0 ? 'Pas encore de réel saisi' : null}
        />
        <StatCard label="Atterrissage total" value={atterrissageTotal} sub="Projection fin de saison" />
        <StatCard label="Résultat budget total" value={resultatBudgetTotal} sub="Prévisionnel saison complète" />
      </div>

      <div className="card" style={{ padding:20, marginBottom:20 }}>
        <p style={{ ...LABEL, marginBottom:14 }}>Prévisionnel vs Réel — cumul août → {dernierMoisAvecReel >= 0 ? MOIS_COURTS[dernierMoisAvecReel] : '—'}</p>
        {dernierMoisAvecReel < 0 ? (
          <p style={{ fontSize:12, color:'#aaa' }}>Pas encore de réel enregistré sur cette saison.</p>
        ) : (
          <GraphiqueBarresComparaison prev={soldePrevCumule[dernierMoisAvecReel]} reel={soldeReelCumule[dernierMoisAvecReel]}
            libellePeriode={`Solde cumulé d'août à ${MOIS_COURTS[dernierMoisAvecReel]}`} />
        )}
      </div>

      <div className="card" style={{ padding:20, marginBottom:20 }}>
        <p style={{ ...LABEL, marginBottom:6 }}>Évolution du solde cumulé sur la saison</p>
        <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>
          Pour chaque mois (d'août à juillet), le solde cumulé depuis le début de la saison (recettes − charges) : en bleu le budget <strong>Prévisionnel</strong>, en orange le <strong>Réel</strong> (s'arrête au dernier mois où tu as saisi du réel), en vert l'<strong>Atterrissage</strong> (ta projection de fin d'année).
        </p>
        <GraphiqueEvolution soldePrevCumule={soldePrevCumule} soldeReelCumule={soldeReelCumule}
          soldeAtterrissageCumule={soldeAtterrissageCumule} dernierMoisAvecReel={dernierMoisAvecReel} />
      </div>
    </div>
  )
}
