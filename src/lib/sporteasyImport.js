import * as XLSX from 'xlsx'

// ─── Utilitaires ────────────────────────────────────────────────────
export function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
export function normName(s) {
  return stripAccents(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
}
export function slugify(s) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const JOURS = { lundi:1, mardi:2, mercredi:3, jeudi:4, vendredi:5, samedi:6, dimanche:0 }
const JOURS_NOMS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MOIS_FR = { 'janv':1,'jan':1,'fevr':2,'fev':2,'mars':3,'avr':4,'mai':5,'juin':6,'juil':7,'aout':8,'sept':9,'oct':10,'nov':11,'dec':12 }

function academicSeason(d) {
  const y = d.getFullYear()
  return d.getMonth() + 1 >= 9 ? `${y}-${y+1}` : `${y-1}-${y}`
}

// Alias de noms : certains cours ont 2 libellés légèrement différents dans SportEasy
// pour le MÊME cours (faute de frappe, ou renommage en cours de route). On matche sur le nom
// reconnu explicitement (pas sur le créneau horaire, qui peut coïncider entre 2 cours différents).
const ALIAS_NOM = {
  'eveil corporel': 'Eveil Corporel & Rythmique',
  'speedance': 'Speedance - ados/adultes',
  'street dance': 'Urban Street', // renommé en cours de saison dans SportEasy
}

// Exceptions : collectes SportEasy sans jour/heure détectable dans le texte (réductions individuelles, etc.)
// -> mapping manuel basé sur recoupement avec d'autres inscriptions de la même personne.
const EXCEPTIONS_COURS = {
  "CARROEN Cynthia - Gym tonique (10%) Carroen Cynthia": { nom:'Gym Tonique', jour:'mardi', heure:'09h00' },
  "Magali ROZALSKA - Gym tonique": { nom:'Gym Tonique', jour:'mardi', heure:'09h00' },
  "Danielle PIGNARRE (gym douce) - Trimestre Gym douce": { nom:'Gym Douce', jour:null, heure:null }, // créneau inconnu
}
// Collectes à exclure du parsing "cotisation hebdo" (gérées par d'autres modules, pas encore construits)
const EXCLURE_REGEX = /dhesion|dh[ée]sion|tage|SPECTACLE/i
const PATTERN_JOURHEURE = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})h(\d{0,2})/i

function parseCoursDepuisCollecte(collecte) {
  if (EXCEPTIONS_COURS[collecte]) {
    const e = EXCEPTIONS_COURS[collecte]
    if (e.jour === null) return { nom: e.nom, jour: null, heure: null }
    return { nom: e.nom, jour: JOURS[e.jour], heure: e.heure }
  }
  const m = collecte.match(PATTERN_JOURHEURE)
  if (!m) return null
  let nom = collecte.slice(0, m.index)
  nom = nom.split(/\(|-\s*\d/)[0].trim().replace(/-+$/,'').trim()
  const jour = JOURS[m[1].toLowerCase()]
  const heure = `${m[2].padStart(2,'0')}h${(m[3]||'00').padEnd(2,'0').slice(0,2)}`
  const nomKey = normName(nom)
  if (ALIAS_NOM[nomKey]) nom = ALIAS_NOM[nomKey]
  return { nom, jour, heure }
}

function splitPersonnes(nom) {
  return String(nom).split(',').map(s => s.trim()).filter(Boolean)
}

// Parse le détail des chèques depuis le champ "Description" (une ligne par chèque)
function parseCheques(desc) {
  const out = []
  if (!desc) return out
  const lignes = String(desc).split('\n')
  for (const ligne of lignes) {
    const parts = ligne.split('\t')
    if (parts.length < 4) continue
    const moisTxt = parts[0].trim(), banque = parts[1].trim(), numero = parts[2].trim(), montantTxt = parts[3]
    const m = moisTxt.match(/^([a-zé.]+)\.?-(\d{2})$/i)
    if (!m) continue
    const moisKey = stripAccents(m[1]).toLowerCase().replace(/û/g,'u').slice(0,4).replace(/\.$/,'')
    const moisNum = MOIS_FR[moisKey] || MOIS_FR[moisKey.slice(0,3)]
    if (!moisNum) continue
    const annee = 2000 + parseInt(m[2], 10)
    const montantMatch = montantTxt.match(/([\d\s]+,\d+)\s*€/)
    if (!montantMatch) continue
    const montant = parseFloat(montantMatch[1].replace(/\s/g,'').replace(',','.'))
    out.push({ date: new Date(annee, moisNum-1, 1), banque, numero_cheque: numero, montant })
  }
  return out
}

const STATUT_MAP = { 'Payé':'encaisse', 'A venir':'en_attente', 'Échec':'rejete', 'Echec':'rejete' }

function hashRef(str) {
  let h = 0
  for (let i=0; i<str.length; i++) { h = (Math.imul(31,h) + str.charCodeAt(i)) | 0 }
  return (h >>> 0).toString(36)
}

// ─── Lecture du fichier ─────────────────────────────────────────────
export async function lireFichierSportEasy(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  return rows
}

// ─── Parsing complet -> objet { cours, membres, inscriptions, reglements, exceptions } ──
export function parserCotisations(rows) {
  const cotis = rows.filter(r => r['Collecte'] && !EXCLURE_REGEX.test(r['Collecte']))
  const sansCours = []
  const lignes = []

  for (const r of cotis) {
    const parsed = parseCoursDepuisCollecte(r['Collecte'])
    if (!parsed) { sansCours.push(r); continue }
    lignes.push({ ...r, _cours: parsed, _personnes: splitPersonnes(r['Payé pour']) })
  }

  // Saison : texte explicite sinon année scolaire de la 1ère date du groupe
  const groupes = {}
  for (const l of lignes) {
    const key = l['Payé pour'] + '||' + l['Collecte']
    const d = l['Date'] instanceof Date ? l['Date'] : new Date(l['Date'])
    if (!groupes[key] || d < groupes[key]) groupes[key] = d
  }
  for (const l of lignes) {
    const m = String(l['Collecte']).match(/(20\d{2})-(20\d{2})/)
    const key = l['Payé pour'] + '||' + l['Collecte']
    l._saison = m ? `${m[1]}-${m[2]}` : academicSeason(groupes[key])
  }

  // Cours distincts
  const coursMap = {}
  for (const l of lignes) {
    const { nom, jour, heure } = l._cours
    if (jour === null || heure === null) { l._cours_id = null; continue }
    const id = 'c-' + slugify(`${nom}-${jour}-${heure}`)
    l._cours_id = id
    if (!coursMap[id]) coursMap[id] = { id, nom, jour, heure }
  }

  // Membres distincts (personnes atomiques)
  const membresMap = {}
  for (const l of lignes) {
    for (const nom of l._personnes) {
      const id = 'm-' + slugify(normName(nom))
      if (!membresMap[id]) membresMap[id] = { id, nom }
    }
  }

  // Inscriptions
  const inscriptionsSet = new Map()
  for (const l of lignes) {
    if (!l._cours_id) continue
    for (const nom of l._personnes) {
      const mid = 'm-' + slugify(normName(nom))
      const key = `${mid}|${l._cours_id}|${l._saison}`
      inscriptionsSet.set(key, { membre_id: mid, cours_id: l._cours_id, saison: l._saison })
    }
  }

  // Règlements
  const reglements = []
  const cheques = lignes.filter(l => l['Moyen de paiement'] === 'Chèque')
  const chequesParDesc = {}
  for (const l of cheques) {
    const key = l['Description'] || ''
    if (!chequesParDesc[key]) chequesParDesc[key] = []
    chequesParDesc[key].push(l)
  }
  for (const [desc, grp] of Object.entries(chequesParDesc)) {
    const first = grp[0]
    const personnes = [...new Set(grp.flatMap(l => l._personnes))]
    const mid = 'm-' + slugify(normName(personnes[0]))
    const autres = personnes.slice(1)
    const groupeId = 'sp' + hashRef(desc)
    const parsed = parseCheques(desc)
    parsed.forEach((chq, i) => {
      const sourceRef = 'se-' + hashRef(`chq|${chq.numero_cheque}|${chq.banque}|${mid}|${chq.montant}`)
      reglements.push({
        membre_id: mid, cours_id: first._cours_id, payeur: first['Payé par'] || personnes[0],
        montant: chq.montant, mode: 'Chèque', banque: chq.banque, numero_cheque: chq.numero_cheque,
        date_encaissement: chq.date, echeance_num: i+1, echeance_total: parsed.length,
        periodicite: 'Mensuel', source: 'sporteasy', groupe_id: groupeId,
        statut: 'encaisse', endosse: true, saison: first._saison,
        commentaire: autres.length ? `Concerne aussi : ${autres.join(', ')}` : null,
        source_ref: sourceRef,
      })
    })
  }

  const carte = lignes.filter(l => l['Moyen de paiement'] === 'Carte')
  const carteParGroupe = {}
  for (const l of carte) {
    const key = l['Payé pour'] + '||' + l['Collecte']
    if (!carteParGroupe[key]) carteParGroupe[key] = []
    carteParGroupe[key].push(l)
  }
  for (const grp of Object.values(carteParGroupe)) {
    grp.sort((a,b) => new Date(a['Date']) - new Date(b['Date']))
    const mid = 'm-' + slugify(normName(grp[0]._personnes[0]))
    grp.forEach((l, i) => {
      const d = l['Date'] instanceof Date ? l['Date'] : new Date(l['Date'])
      const sourceRef = 'se-' + hashRef(`cb|${mid}|${l._cours_id}|${d.toISOString().slice(0,10)}|${l['Montant payé']}`)
      reglements.push({
        membre_id: mid, cours_id: l._cours_id, payeur: l['Payé par'] || grp[0]._personnes[0],
        montant: Number(l['Montant payé']), mode: 'CB', banque: null, numero_cheque: null,
        date_encaissement: d, echeance_num: i+1, echeance_total: grp.length,
        periodicite: grp.length > 1 ? 'Mensuel' : 'Unique', source: 'sporteasy', groupe_id: null,
        statut: STATUT_MAP[l['Statut']] || 'en_attente', endosse: true, saison: l._saison,
        commentaire: null, source_ref: sourceRef,
      })
    })
  }

  const autresModes = lignes.filter(l => ['Espèces','Collecte Tarif Reduit','Autre'].includes(l['Moyen de paiement']))
  for (const l of autresModes) {
    const mid = 'm-' + slugify(normName(l._personnes[0]))
    const mode = l['Moyen de paiement'] === 'Espèces' ? 'Espèces' : 'Autre'
    const d = l['Date'] instanceof Date ? l['Date'] : new Date(l['Date'])
    const sourceRef = 'se-' + hashRef(`autre|${mid}|${l._cours_id}|${d.toISOString().slice(0,10)}|${l['Montant payé']}`)
    reglements.push({
      membre_id: mid, cours_id: l._cours_id, payeur: l['Payé par'] || l._personnes[0],
      montant: Number(l['Montant payé']), mode, banque: null, numero_cheque: null,
      date_encaissement: d, echeance_num: 1, echeance_total: 1,
      periodicite: 'Unique', source: 'sporteasy', groupe_id: null,
      statut: STATUT_MAP[l['Statut']] || 'encaisse', endosse: true, saison: l._saison,
      commentaire: mode === 'Autre' ? `Collecte SportEasy : ${l['Collecte']}` : null,
      source_ref: sourceRef,
    })
  }

  return {
    cours: Object.values(coursMap),
    membres: Object.values(membresMap),
    inscriptions: [...inscriptionsSet.values()],
    reglements,
    sansCours: [...new Set(sansCours.map(r => r['Collecte']))],
    joursNoms: JOURS_NOMS,
  }
}

// Suggère un membre déjà existant dont le nom ressemble à un nom nouvellement rencontré.
// Ne fusionne jamais automatiquement : sert uniquement à proposer un choix à l'utilisateur.
export function suggererMembreExistant(nomNouveau, membresExistants) {
  const tNouveau = new Set(normName(nomNouveau).split(' ').filter(Boolean))
  let meilleur = null, meilleurScore = 0
  for (const m of membresExistants) {
    const tExist = new Set(normName(m.nom).split(' ').filter(Boolean))
    if (tExist.size === 0 || tNouveau.size === 0) continue
    const identiques = tExist.size === tNouveau.size && [...tExist].every(t => tNouveau.has(t))
    const inclusion = [...tExist].every(t => tNouveau.has(t)) || [...tNouveau].every(t => tExist.has(t))
    const intersection = [...tExist].filter(t => tNouveau.has(t)).length
    let score = 0
    if (identiques) score = 100
    else if (inclusion && intersection > 0) score = 70
    else if (intersection > 0) score = 30 * intersection
    if (score > meilleurScore) { meilleurScore = score; meilleur = m }
  }
  return meilleurScore >= 30 ? meilleur : null
}

