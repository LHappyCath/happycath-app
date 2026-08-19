// ─── Calcul des jours fériés français (formule, valable pour n'importe quelle saison) ───
// Algorithme de Meeus/Jones/Butcher pour la date de Pâques (calendrier grégorien).
function datePaques(annee) {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19*a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2*e + 2*i - h - k) % 7
  const m = Math.floor((a + 11*h + 22*l) / 451)
  const mois = Math.floor((h + l - 7*m + 114) / 31)
  const jour = ((h + l - 7*m + 114) % 31) + 1
  return new Date(annee, mois - 1, jour)
}

function ajouterJours(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function iso(date) { return date.toISOString().slice(0, 10) }

// Retourne les jours fériés français couvrant une saison "AAAA-AAAA" (de septembre à août).
// Les vacances scolaires, elles, n'ont pas de formule : à ressaisir chaque saison.
export function joursFeriesSaison(saison) {
  const [anneeDebut, anneeFin] = saison.split('-').map(Number)
  const paquesFin = datePaques(anneeFin)
  return [
    { date: `${anneeDebut}-11-01`, libelle: 'Toussaint' },
    { date: `${anneeDebut}-11-11`, libelle: 'Armistice' },
    { date: `${anneeDebut}-12-25`, libelle: 'Noël' },
    { date: `${anneeFin}-01-01`, libelle: 'Jour de l\'an' },
    { date: iso(ajouterJours(paquesFin, 1)), libelle: 'Lundi de Pâques' },
    { date: `${anneeFin}-05-01`, libelle: 'Fête du travail' },
    { date: `${anneeFin}-05-08`, libelle: 'Victoire 1945' },
    { date: iso(ajouterJours(paquesFin, 39)), libelle: 'Ascension' },
    { date: iso(ajouterJours(paquesFin, 50)), libelle: 'Lundi de Pentecôte' },
    { date: `${anneeFin}-07-14`, libelle: 'Fête nationale' },
    { date: `${anneeFin}-08-15`, libelle: 'Assomption' },
  ]
}

// ─── Statut d'un jour donné, selon les périodes exceptionnelles saisies ───
// 'ferme' est prioritaire sur 'gym_uniquement' en cas de chevauchement.
export function statutJour(dateStr, joursExceptionnels) {
  let statut = 'normal'
  for (const j of joursExceptionnels) {
    if (dateStr >= j.date_debut && dateStr <= j.date_fin) {
      if (j.statut === 'ferme') return 'ferme'
      if (j.statut === 'gym_uniquement') statut = 'gym_uniquement'
    }
  }
  return statut
}

// ─── Nombre de séances d'un cours sur la saison, selon son jour de la semaine et sa catégorie ───
export function compterSeances({ coursJour, categorie, dateDebut, dateFin, joursExceptionnels }) {
  if (!dateDebut || !dateFin) return 0
  let compte = 0
  let d = new Date(dateDebut + 'T12:00:00')
  const fin = new Date(dateFin + 'T12:00:00')
  while (d <= fin) {
    if (d.getDay() === coursJour) {
      const statut = statutJour(iso(d), joursExceptionnels)
      if (statut === 'normal' || (statut === 'gym_uniquement' && categorie === 'Gym')) compte++
    }
    d = ajouterJours(d, 1)
  }
  return compte
}

// ─── Liste des jours du mois avec leur statut, pour l'affichage calendrier ───
export function joursDuMois(annee, moisIndex, joursExceptionnels) {
  const jours = []
  const nbJours = new Date(annee, moisIndex + 1, 0).getDate()
  for (let j = 1; j <= nbJours; j++) {
    const d = new Date(annee, moisIndex, j)
    const dateStr = iso(d)
    jours.push({ jour: j, date: dateStr, weekday: d.getDay(), statut: statutJour(dateStr, joursExceptionnels) })
  }
  return jours
}

// 12 mois de la saison "AAAA-AAAA" : septembre (anneeDebut) → août (anneeFin)
export function moisDeSaison(saison) {
  const [anneeDebut] = saison.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const moisIndex = (8 + i) % 12 // 8 = septembre (0-indexé)
    const annee = moisIndex < 8 ? anneeDebut + 1 : anneeDebut
    return { annee, moisIndex }
  })
}

export const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
