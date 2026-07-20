import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'

const DataContext = createContext(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

const CACHE_KEY = 'happycath_store_v1'

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() })) } catch(e) {}
}

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch(e) { return null }
}

// File d'attente hors ligne
const QUEUE_KEY = 'happycath_queue_v1'

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch(e) { return [] }
}

function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch(e) {}
}

export function DataProvider({ children }) {
  const [cours, setCours] = useState([])
  const [membres, setMembres] = useState([])
  const [inscriptions, setInscriptions] = useState([])
  const [historique, setHistorique] = useState([])
  const [abonnements, setAbonnements] = useState([])
  const [reglements, setReglements] = useState([])
  const [tarifs, setTarifs] = useState([])
  const [remises, setRemises] = useState([])
  const [parametres, setParametres] = useState({})
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [queueSize, setQueueSize] = useState(loadQueue().length)
  const realtimeSub = useRef(null)

  // ─── CHARGEMENT DEPUIS SUPABASE ──────────────────────────────
  const loadAll = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = loadCache()
      if (cached) {
        setCours(cached.cours || [])
        setMembres(cached.membres || [])
        setInscriptions(cached.inscriptions || [])
        setHistorique(cached.historique || [])
        setAbonnements(cached.abonnements || [])
        setReglements(cached.reglements || [])
        setTarifs(cached.tarifs || [])
        setParametres(cached.parametres || {})
        setRemises(cached.remises || [])
      }
      setLoading(false)
      return
    }

    try {
      const [
        { data: c }, { data: m }, { data: i }, { data: h }, { data: a }, { data: r }, { data: t }, { data: p }, { data: rm }
      ] = await Promise.all([
        supabase.from('cours').select('*').order('jour').order('heure'),
        supabase.from('membres').select('*').order('nom'),
        supabase.from('inscriptions').select('*'),
        supabase.from('historique').select('*').order('date', { ascending: false }),
        supabase.from('abonnements').select('*'),
        supabase.from('reglements').select('*').order('date_encaissement', { ascending: false }),
        supabase.from('tarifs').select('*'),
        supabase.from('parametres').select('*'),
        supabase.from('remises').select('*').order('numero', { ascending: false }),
      ])

      const paramsObj = Object.fromEntries((p||[]).map(x => [x.cle, x.valeur]))
      const data = { cours: c||[], membres: m||[], inscriptions: i||[], historique: h||[], abonnements: a||[], reglements: r||[], tarifs: t||[], parametres: paramsObj, remises: rm||[] }
      setCours(data.cours)
      setMembres(data.membres)
      setInscriptions(data.inscriptions)
      setHistorique(data.historique)
      setAbonnements(data.abonnements)
      setReglements(data.reglements)
      setTarifs(data.tarifs)
      setParametres(data.parametres)
      setRemises(data.remises)
      saveCache(data)
    } catch(e) {
      console.error('loadAll error:', e)
      // Fallback cache
      const cached = loadCache()
      if (cached) {
        setCours(cached.cours || [])
        setMembres(cached.membres || [])
        setInscriptions(cached.inscriptions || [])
        setHistorique(cached.historique || [])
        setAbonnements(cached.abonnements || [])
        setReglements(cached.reglements || [])
        setTarifs(cached.tarifs || [])
        setParametres(cached.parametres || {})
        setRemises(cached.remises || [])
      }
    }
    setLoading(false)
  }, [])

  // ─── SYNC FILE D'ATTENTE ─────────────────────────────────────
  const syncQueue = useCallback(async () => {
    const queue = loadQueue()
    if (queue.length === 0) return
    setSyncing(true)
    const failed = []
    for (const op of queue) {
      try {
        if (op.action === 'upsert') {
          await supabase.from(op.table).upsert(op.payload)
        } else if (op.action === 'insert') {
          await supabase.from(op.table).insert(op.payload)
        } else if (op.action === 'update') {
          await supabase.from(op.table).update(op.payload).eq('id', op.id)
        }
      } catch(e) {
        failed.push(op)
      }
    }
    saveQueue(failed)
    setQueueSize(failed.length)
    setSyncing(false)
    if (failed.length === 0) await loadAll()
  }, [loadAll])

  // ─── ÉCOUTE ONLINE/OFFLINE ───────────────────────────────────
  useEffect(() => {
    const onOnline = async () => {
      setOnline(true)
      await syncQueue()
      await loadAll()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncQueue, loadAll])

  // ─── REALTIME SUPABASE ───────────────────────────────────────
  useEffect(() => {
    loadAll()
    if (navigator.onLine) syncQueue()
    if (!navigator.onLine) return

    realtimeSub.current = supabase.channel('global_store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cours' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membres' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inscriptions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historique' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'abonnements' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reglements' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarifs' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remises' }, loadAll)
      .subscribe()

    return () => { if (realtimeSub.current) supabase.removeChannel(realtimeSub.current) }
  }, [loadAll, syncQueue])

  // Ajouter une opération à la file d'attente hors ligne
  function enqueue(op) {
    const q = loadQueue()
    q.push({ ...op, timestamp: Date.now() })
    saveQueue(q)
    setQueueSize(q.length)
  }

  // Upsert générique (insert ou update)
  async function upsert(table, payload, localUpdate) {
    // Mise à jour optimiste locale immédiate
    localUpdate()
    // Mettre à jour le cache
    const cached = loadCache()
    if (cached && cached[table]) {
      const idx = cached[table].findIndex(x => x.id === payload.id)
      if (idx >= 0) cached[table][idx] = { ...cached[table][idx], ...payload }
      else cached[table].unshift(payload)
      saveCache(cached)
    }

    if (!navigator.onLine) {
      enqueue({ action: 'upsert', table, payload })
      return { offline: true }
    }
    try {
      const { error } = await supabase.from(table).upsert(payload)
      if (error) throw error
      return { success: true }
    } catch(e) {
      enqueue({ action: 'upsert', table, payload })
      return { queued: true }
    }
  }

  // Insert
  async function insert(table, payload, localUpdate, localRevert) {
    localUpdate()
    const cached = loadCache()
    if (cached && cached[table]) {
      cached[table].unshift(payload)
      saveCache(cached)
    }

    if (!navigator.onLine) {
      enqueue({ action: 'insert', table, payload })
      return { offline: true }
    }
    try {
      const { error } = await supabase.from(table).insert(payload)
      if (error) throw error
      return { success: true }
    } catch(e) {
      if (!navigator.onLine) {
        enqueue({ action: 'insert', table, payload })
        return { queued: true }
      }
      if (localRevert) localRevert()
      console.error(`Erreur enregistrement ${table}:`, e)
      return { error: e.message || 'Échec de l\'enregistrement' }
    }
  }

  // ─── ACTIONS MÉTIER ──────────────────────────────────────────

  function saisonDeDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    const y = d.getFullYear()
    return d.getMonth() + 1 >= 9 ? `${y}-${y+1}` : `${y-1}-${y}`
  }

  async function sauvegarderAppel(payload) {
    const { id, cours_id, cours_nom, date, presents, absents, guests } = payload
    const histo = { id, cours_id, cours_nom, date, presents, absents: absents || [], guests, saison: saisonDeDate(date) }

    return upsert('historique', histo, () => {
      setHistorique(prev => {
        const idx = prev.findIndex(h => h.id === id)
        if (idx >= 0) { const n = [...prev]; n[idx] = histo; return n }
        return [histo, ...prev]
      })
    })
  }

  async function sauvegarderCours(payload) {
    const isNew = !payload.id || !cours.find(c => c.id === payload.id)
    const data = { ...payload, actif: true }

    if (isNew) {
      return insert('cours', data, () => setCours(prev => [...prev, data].sort((a,b) => a.jour - b.jour || a.heure.localeCompare(b.heure))))
    }
    return upsert('cours', data, () => setCours(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c)))
  }

  async function supprimerCours(id) {
    // Archivage (pas une vraie suppression) : le cours reste consultable dans l'historique
    if (!navigator.onLine) return { offline: true }
    await supabase.from('cours').update({ actif: false }).eq('id', id)
    setCours(prev => prev.map(c => c.id === id ? { ...c, actif: false } : c))
    const cached = loadCache()
    if (cached) { cached.cours = (cached.cours||[]).map(c => c.id === id ? { ...c, actif: false } : c); saveCache(cached) }
    return { success: true }
  }

  async function reactiverCours(id) {
    if (!navigator.onLine) return { offline: true }
    await supabase.from('cours').update({ actif: true }).eq('id', id)
    setCours(prev => prev.map(c => c.id === id ? { ...c, actif: true } : c))
    const cached = loadCache()
    if (cached) { cached.cours = (cached.cours||[]).map(c => c.id === id ? { ...c, actif: true } : c); saveCache(cached) }
    return { success: true }
  }

  async function sauvegarderMembre(payload) {
    const isNew = !payload.id || !membres.find(m => m.id === payload.id)
    const data = { ...payload, actif: true }

    if (isNew) {
      return insert('membres', data, () => setMembres(prev => [...prev, data].sort((a,b) => a.nom.localeCompare(b.nom))))
    }
    return upsert('membres', data, () => setMembres(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m)))
  }

  async function archiverMembre(id) {
    if (!navigator.onLine) return { offline: true }
    await supabase.from('membres').update({ actif: false }).eq('id', id)
    setMembres(prev => prev.map(m => m.id === id ? { ...m, actif: false } : m))
    const cached = loadCache()
    if (cached) { cached.membres = (cached.membres||[]).map(m => m.id === id ? { ...m, actif: false } : m); saveCache(cached) }
    return { success: true }
  }

  async function reactiverMembre(id) {
    if (!navigator.onLine) return { offline: true }
    await supabase.from('membres').update({ actif: true }).eq('id', id)
    setMembres(prev => prev.map(m => m.id === id ? { ...m, actif: true } : m))
    const cached = loadCache()
    if (cached) { cached.membres = (cached.membres||[]).map(m => m.id === id ? { ...m, actif: true } : m); saveCache(cached) }
    return { success: true }
  }

  async function sauvegarderInscriptions(membreId, coursIds) {
    const newInscrits = coursIds.map(cId => ({ cours_id: cId, membre_id: membreId }))

    setInscriptions(prev => [
      ...prev.filter(i => i.membre_id !== membreId),
      ...newInscrits
    ])

    if (!navigator.onLine) {
      enqueue({ action: 'upsert', table: '_inscriptions_batch', payload: { membreId, coursIds } })
      return { offline: true }
    }

    await supabase.from('inscriptions').delete().eq('membre_id', membreId)
    if (coursIds.length > 0) await supabase.from('inscriptions').insert(newInscrits)
    const cached = loadCache()
    if (cached) {
      cached.inscriptions = [...(cached.inscriptions||[]).filter(i=>i.membre_id!==membreId), ...newInscrits]
      saveCache(cached)
    }
    return { success: true }
  }

  async function supprimerAppel(id) {
    if (!navigator.onLine) return { offline: true }
    await supabase.from('historique').delete().eq('id', id)
    setHistorique(prev => prev.filter(h => h.id !== id))
    const cached = loadCache()
    if (cached) { cached.historique = (cached.historique||[]).filter(h => h.id !== id); saveCache(cached) }
    return { success: true }
  }

  async function sauvegarderAbonnement(membreId, aboData) {
    if (!navigator.onLine) {
      enqueue({ action: 'upsert', table: '_abonnement', payload: { membreId, ...aboData } })
      return { offline: true }
    }
    await supabase.from('abonnements').delete().eq('membre_id', membreId).eq('saison', saisonActive)
    if (aboData.date_debut) {
      await supabase.from('abonnements').insert({ membre_id: membreId, saison: saisonActive, ...aboData, statut: 'actif' })
    }
    await loadAll()
    return { success: true }
  }

  // Créer plusieurs chèques d'un coup (numéros consécutifs)
  // params: { payeur, membreId, coursId, banque, premierNumero, nbCheques, montantParCheque,
  //           premiereDateEncaissement, periodicite ('Mensuel'|'Trimestriel'|'Semestriel'|'Annuel'|'Unique'),
  //           saison, mois, trimestre }
  async function creerReglementsGroupes(p) {
    const groupeId = 'grp' + Date.now().toString(36)
    const decalageMois = { Mensuel: 1, Trimestriel: 3, Semestriel: 6, Annuel: 12, Unique: 0 }[p.periodicite] || 1
    const premierNum = parseInt(p.premierNumero, 10)
    const isNumeric = !isNaN(premierNum) && String(premierNum) === String(p.premierNumero).trim()

    const lignes = Array.from({ length: p.nbCheques }, (_, idx) => {
      const dateEnc = new Date(p.premiereDateEncaissement + 'T12:00:00')
      dateEnc.setMonth(dateEnc.getMonth() + idx * decalageMois)
      const numeroCheque = isNumeric ? String(premierNum + idx) : `${p.premierNumero}-${idx + 1}`
      return {
        membre_id: p.membreId || null,
        cours_id: p.coursId || null,
        payeur: p.payeur,
        montant: Number(p.montantParCheque),
        mode: 'Chèque',
        banque: p.banque,
        numero_cheque: numeroCheque,
        date_encaissement: dateEnc.toISOString().slice(0, 10),
        periodicite: p.periodicite,
        echeance_num: idx + 1,
        echeance_total: p.nbCheques,
        source: p.source || 'direct',
        groupe_id: groupeId,
        statut: 'en_attente',
        endosse: false,
        saison: p.saison || saisonActive,
      }
    })

    setReglements(prev => [...lignes, ...prev])

    if (!navigator.onLine) {
      enqueue({ action: 'insert', table: 'reglements', payload: lignes })
      return { offline: true, lignes }
    }
    try {
      const { error } = await supabase.from('reglements').insert(lignes)
      if (error) throw error
      const cached = loadCache()
      if (cached) { cached.reglements = [...lignes, ...(cached.reglements||[])]; saveCache(cached) }
      return { success: true, lignes }
    } catch(e) {
      enqueue({ action: 'insert', table: 'reglements', payload: lignes })
      return { queued: true, lignes }
    }
  }

  // Insère des lignes de chèques déjà construites telles quelles (respecte les ajustements
  // individuels faits à l'écran, contrairement à creerReglementsGroupes qui régénère tout)
  async function creerReglementsPersonnalises(lignes, meta) {
    const groupeId = 'grp' + Date.now().toString(36)
    // Payload réel envoyé à Supabase : PAS d'id (la colonne est un bigint auto-généré, un id texte est rejeté)
    const payload = lignes.map((l, idx) => ({
      membre_id: meta.membreId || null,
      cours_id: meta.coursId || null,
      payeur: meta.payeur,
      montant: Number(l.montant),
      mode: 'Chèque',
      banque: meta.banque,
      numero_cheque: l.numero_cheque,
      date_encaissement: l.date_encaissement,
      periodicite: meta.periodicite,
      echeance_num: idx + 1,
      echeance_total: lignes.length,
      source: meta.source || 'direct',
      groupe_id: groupeId,
      statut: 'en_attente',
      endosse: false,
      saison: meta.saison || saisonActive,
    }))
    // Affichage optimiste immédiat avec un id temporaire local (jamais envoyé à Supabase)
    const temporaires = payload.map((p, i) => ({ ...p, id: `temp-${Date.now()}-${i}` }))

    setReglements(prev => [...temporaires, ...prev])
    if (!navigator.onLine) { enqueue({ action: 'insert', table: 'reglements', payload }); return { offline: true, finales: temporaires } }
    try {
      const { data, error } = await supabase.from('reglements').insert(payload).select()
      if (error) throw error
      // Remplace les lignes temporaires par les vraies (avec le véritable id renvoyé par Supabase)
      setReglements(prev => [...data, ...prev.filter(r => !temporaires.some(t => t.id === r.id))])
      const cached = loadCache()
      if (cached) { cached.reglements = [...data, ...(cached.reglements||[])]; saveCache(cached) }
      return { success: true, finales: data }
    } catch(e) {
      if (!navigator.onLine) {
        enqueue({ action: 'insert', table: 'reglements', payload })
        return { queued: true, finales: temporaires }
      }
      // Vraiment en ligne mais l'enregistrement a échoué (ex: colonne manquante, contrainte...) :
      // on annule l'ajout optimiste local pour ne pas afficher une donnée qui n'est pas réellement enregistrée,
      // et on remonte l'erreur pour qu'elle soit visible plutôt que silencieusement perdue.
      setReglements(prev => prev.filter(r => !temporaires.some(t => t.id === r.id)))
      console.error('Erreur enregistrement chèques:', e)
      return { error: e.message || "Échec de l'enregistrement des chèques" }
    }
  }

  // Un seul règlement (CB, espèces, virement, ou chèque isolé)
  async function creerReglement(payload) {
    const data = {
      statut: payload.mode === 'CB' ? 'encaisse' : 'en_attente',
      endosse: false,
      echeance_num: 1,
      echeance_total: 1,
      source: 'direct',
      saison: saisonActive,
      ...payload,
    }
    const temp = { ...data, id: `temp-${Date.now()}` }
    setReglements(prev => [temp, ...prev])
    if (!navigator.onLine) { enqueue({ action: 'insert', table: 'reglements', payload: data }); return { offline: true } }
    try {
      const { data: saved, error } = await supabase.from('reglements').insert(data).select()
      if (error) throw error
      setReglements(prev => [saved[0], ...prev.filter(r => r.id !== temp.id)])
      return { success: true }
    } catch(e) {
      if (!navigator.onLine) {
        enqueue({ action: 'insert', table: 'reglements', payload: data })
        return { queued: true }
      }
      setReglements(prev => prev.filter(r => r.id !== temp.id))
      console.error('Erreur enregistrement règlement:', e)
      return { error: e.message || "Échec de l'enregistrement" }
    }
  }

  async function modifierReglement(id, patch) {
    setReglements(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
    const cached = loadCache()
    if (cached?.reglements) {
      const idx = cached.reglements.findIndex(r => r.id === id)
      if (idx >= 0) { cached.reglements[idx] = { ...cached.reglements[idx], ...patch }; saveCache(cached) }
    }
    if (!navigator.onLine) { enqueue({ action: 'update', table: 'reglements', id, payload: patch }); return { offline: true } }
    try {
      const { error } = await supabase.from('reglements').update(patch).eq('id', id)
      if (error) throw error
      return { success: true }
    } catch(e) {
      enqueue({ action: 'update', table: 'reglements', id, payload: patch })
      return { queued: true }
    }
  }

  // Marquer/démarquer l'endossement d'un chèque
  async function toggleEndossement(id, endosse) {
    return modifierReglement(id, { endosse, date_endossement: endosse ? new Date().toISOString() : null })
  }

  async function supprimerReglement(id) {
    if (!navigator.onLine) return { offline: true }
    await supabase.from('reglements').delete().eq('id', id)
    setReglements(prev => prev.filter(r => r.id !== id))
    const cached = loadCache()
    if (cached) { cached.reglements = (cached.reglements||[]).filter(r => r.id !== id); saveCache(cached) }
    return { success: true }
  }

  // Tarifs
  async function sauvegarderTarif(payload) {
    const isNew = !tarifs.find(t => t.cours_id === payload.cours_id && t.periodicite === payload.periodicite && t.saison === (payload.saison||saisonActive))
    const data = { saison: saisonActive, ...payload }
    if (!navigator.onLine) { enqueue({ action: 'upsert', table: 'tarifs', payload: data }); return { offline: true } }
    try {
      const { data: saved, error } = await supabase.from('tarifs').upsert(data, { onConflict: 'cours_id,periodicite,saison' }).select()
      if (error) throw error
      setTarifs(prev => {
        const idx = prev.findIndex(t => t.cours_id === data.cours_id && t.periodicite === data.periodicite && t.saison === data.saison)
        if (idx >= 0) { const n = [...prev]; n[idx] = saved?.[0] || data; return n }
        return [...prev, saved?.[0] || data]
      })
      return { success: true }
    } catch(e) {
      enqueue({ action: 'upsert', table: 'tarifs', payload: data })
      return { queued: true }
    }
  }

  // Import en masse (ex: SportEasy) — ne crée que ce qui n'existe pas déjà
  async function importerLot({ cours: nCours = [], membres: nMembres = [], inscriptions: nInscriptions = [], reglements: nReglements = [] }) {
    const coursIds = new Set(cours.map(c => c.id))
    const membreIds = new Set(membres.map(m => m.id))
    const inscriptionKeys = new Set(inscriptions.map(i => `${i.membre_id}|${i.cours_id}|${i.saison}`))
    const reglementRefs = new Set(reglements.map(r => r.source_ref).filter(Boolean))

    const aCreerCours = nCours.filter(c => !coursIds.has(c.id))
    const aCreerMembres = nMembres.filter(m => !membreIds.has(m.id))
    const aCreerInscriptions = nInscriptions.filter(i => !inscriptionKeys.has(`${i.membre_id}|${i.cours_id}|${i.saison}`))
    const aCreerReglements = nReglements.filter(r => !reglementRefs.has(r.source_ref))

    const fmtDate = (d) => d instanceof Date ? d.toISOString().slice(0,10) : d

    try {
      if (aCreerCours.length) {
        const { error } = await supabase.from('cours').insert(aCreerCours.map(c => ({ ...c, actif: true })))
        if (error) throw error
      }
      if (aCreerMembres.length) {
        const { error } = await supabase.from('membres').insert(aCreerMembres.map(m => ({ ...m, actif: true })))
        if (error) throw error
      }
      if (aCreerInscriptions.length) {
        const { error } = await supabase.from('inscriptions').insert(aCreerInscriptions)
        if (error) throw error
      }
      if (aCreerReglements.length) {
        const payload = aCreerReglements.map(r => ({ ...r, date_encaissement: fmtDate(r.date_encaissement) }))
        const { error } = await supabase.from('reglements').insert(payload)
        if (error) throw error
      }
      setCours(prev => [...prev, ...aCreerCours])
      setMembres(prev => [...prev, ...aCreerMembres])
      setInscriptions(prev => [...prev, ...aCreerInscriptions])
      setReglements(prev => [...aCreerReglements.map(r => ({...r, date_encaissement: fmtDate(r.date_encaissement)})), ...prev])
      return {
        success: true,
        nbCours: aCreerCours.length, nbMembres: aCreerMembres.length,
        nbInscriptions: aCreerInscriptions.length, nbReglements: aCreerReglements.length,
      }
    } catch (e) {
      return { error: e.message || 'Erreur import' }
    }
  }

  const saisonActive = parametres.saison_active || '2026-2027'

  async function definirSaisonActive(saison) {
    setParametres(prev => ({ ...prev, saison_active: saison }))
    const cached = loadCache()
    if (cached) { cached.parametres = { ...(cached.parametres||{}), saison_active: saison }; saveCache(cached) }
    try {
      const { error } = await supabase.from('parametres').upsert({ cle: 'saison_active', valeur: saison }, { onConflict: 'cle' })
      if (error) throw error
      return { success: true }
    } catch(e) {
      return { error: e.message }
    }
  }

  // Mise à jour en masse des fiches membres (ex: enrichissement depuis un roster SportEasy)
  async function mettreAJourMembresLot(updates) {
    if (!updates.length) return { success: true, nb: 0 }
    try {
      for (const { id, patch } of updates) {
        const { error } = await supabase.from('membres').update(patch).eq('id', id)
        if (error) throw error
      }
      setMembres(prev => prev.map(m => {
        const u = updates.find(u => u.id === m.id)
        return u ? { ...m, ...u.patch } : m
      }))
      return { success: true, nb: updates.length }
    } catch (e) {
      return { error: e.message || 'Erreur mise à jour' }
    }
  }

  // Mise à jour groupée de fiches membres (ex: import roster stage/adhérents)
  // patches: [{ id, champs: { telephone, email, ... } }]
  async function mettreAJourMembres(patches) {
    try {
      for (const p of patches) {
        const { error } = await supabase.from('membres').update(p.champs).eq('id', p.id)
        if (error) throw error
      }
      setMembres(prev => prev.map(m => {
        const p = patches.find(x => x.id === m.id)
        return p ? { ...m, ...p.champs } : m
      }))
      return { success: true, nb: patches.length }
    } catch (e) {
      return { error: e.message || 'Erreur mise à jour' }
    }
  }

  // ─── REMISES DE CHÈQUES ──────────────────────────────────────
  // Crée plusieurs remises d'un coup à partir de lots déjà préparés (groupés/triés côté écran)
  // lots: [{ banque, cheques: [reglement, ...], dateRemise }]
  async function creerRemises(lots) {
    // Numérotation séquentielle courte par type (CHQ / ESP), ex: CHQ-12, ESP-3 — le détail (banques, mois)
    // reste disponible dans les champs banque/date_remise, pas dans l'identifiant lui-même.
    const compteurs = {}
    const nouvellesRemises = []
    const patchesReglements = []

    for (const lot of lots) {
      const type = lot.type || 'CHQ'
      if (!(type in compteurs)) {
        compteurs[type] = remises.filter(r => r.type === type).length
      }
      compteurs[type]++
      const numero = `${type}-${compteurs[type]}`
      const montantTotal = lot.cheques.reduce((s,c) => s + Number(c.montant||0), 0)
      nouvellesRemises.push({
        numero, type, banque: lot.banque, date_remise: lot.dateRemise,
        montant_total: montantTotal, nb_reglements: lot.cheques.length, statut: 'prepare',
      })
      for (const chq of lot.cheques) {
        patchesReglements.push({ id: chq.id, numero_remise: numero })
      }
    }

    try {
      const { data: inserted, error } = await supabase.from('remises').insert(nouvellesRemises).select()
      if (error) throw error
      for (const p of patchesReglements) {
        await supabase.from('reglements').update({ numero_remise: p.numero_remise }).eq('id', p.id)
      }
      setRemises(prev => [...(inserted||nouvellesRemises), ...prev])
      setReglements(prev => prev.map(r => {
        const p = patchesReglements.find(x => x.id === r.id)
        return p ? { ...r, numero_remise: p.numero_remise } : r
      }))
      return { success: true, nb: nouvellesRemises.length }
    } catch(e) {
      return { error: e.message || 'Erreur lors de la création des remises' }
    }
  }

  async function ajouterChequesRemise(numero, cheques) {
    const remise = remises.find(r => r.numero === numero)
    if (!remise) return { error: 'Remise introuvable' }
    const nouveauTotal = Number(remise.montant_total||0) + cheques.reduce((s,c) => s + Number(c.montant||0), 0)
    const nouveauNb = Number(remise.nb_reglements||0) + cheques.length
    const banquesExistantes = (remise.banque||'').split(',').map(b=>b.trim()).filter(Boolean)
    const nouvellesBanques = [...new Set(cheques.map(c => c.banque || 'Banque non renseignée'))]
    const banqueFusionnee = [...new Set([...banquesExistantes, ...nouvellesBanques])].join(', ')
    try {
      for (const c of cheques) {
        const { error } = await supabase.from('reglements').update({ numero_remise: numero }).eq('id', c.id)
        if (error) throw error
      }
      const { error } = await supabase.from('remises').update({ montant_total: nouveauTotal, nb_reglements: nouveauNb, banque: banqueFusionnee }).eq('numero', numero)
      if (error) throw error
      setRemises(prev => prev.map(r => r.numero === numero ? { ...r, montant_total: nouveauTotal, nb_reglements: nouveauNb, banque: banqueFusionnee } : r))
      setReglements(prev => prev.map(r => cheques.some(c => c.id === r.id) ? { ...r, numero_remise: numero } : r))
      return { success: true }
    } catch(e) {
      return { error: e.message || "Erreur lors de l'ajout à la remise" }
    }
  }

  async function modifierStatutRemise(numero, statut) {
    try {
      const { error } = await supabase.from('remises').update({ statut }).eq('numero', numero)
      if (error) throw error
      setRemises(prev => prev.map(r => r.numero === numero ? { ...r, statut } : r))
      return { success: true }
    } catch(e) {
      return { error: e.message }
    }
  }

  // Supprime une remise (les chèques qu'elle contenait redeviennent disponibles pour une prochaine remise)
  async function supprimerRemise(numero) {
    try {
      const { error: e1 } = await supabase.from('reglements').update({ numero_remise: null }).eq('numero_remise', numero)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('remises').delete().eq('numero', numero)
      if (e2) throw e2
      setRemises(prev => prev.filter(r => r.numero !== numero))
      setReglements(prev => prev.map(r => r.numero_remise === numero ? { ...r, numero_remise: null } : r))
      return { success: true }
    } catch(e) {
      return { error: e.message || 'Erreur lors de la suppression de la remise' }
    }
  }

  // Retire un seul chèque d'une remise (il redevient disponible pour une prochaine remise).
  // Si la remise devient vide, elle est supprimée automatiquement.
  async function retirerChequeRemise(chequeId) {
    const cheque = reglements.find(r => r.id === chequeId)
    if (!cheque || !cheque.numero_remise) return { error: 'Chèque introuvable ou pas dans une remise' }
    const numero = cheque.numero_remise
    const remise = remises.find(r => r.numero === numero)
    try {
      const { error: e1 } = await supabase.from('reglements').update({ numero_remise: null }).eq('id', chequeId)
      if (e1) throw e1
      setReglements(prev => prev.map(r => r.id === chequeId ? { ...r, numero_remise: null } : r))
      if (remise && remise.nb_reglements <= 1) {
        const { error: e2 } = await supabase.from('remises').delete().eq('numero', numero)
        if (e2) throw e2
        setRemises(prev => prev.filter(r => r.numero !== numero))
      } else if (remise) {
        const nouveauNb = remise.nb_reglements - 1
        const nouveauTotal = Number(remise.montant_total||0) - Number(cheque.montant||0)
        const { error: e3 } = await supabase.from('remises').update({ nb_reglements: nouveauNb, montant_total: nouveauTotal }).eq('numero', numero)
        if (e3) throw e3
        setRemises(prev => prev.map(r => r.numero === numero ? { ...r, nb_reglements: nouveauNb, montant_total: nouveauTotal } : r))
      }
      return { success: true }
    } catch(e) {
      return { error: e.message || 'Erreur lors du retrait du chèque' }
    }
  }

  async function ajouterBanque(nom) {
    const nomPropre = nom.trim()
    if (!nomPropre) return { error: 'Nom vide' }
    const actuelles = banquesConnues
    if (actuelles.includes(nomPropre)) return { success: true }
    const nouvelles = [...actuelles, nomPropre].sort((a,b) => a.localeCompare(b))
    return definirParametre('banques_connues', JSON.stringify(nouvelles))
  }

  async function definirParametre(cle, valeur) {
    setParametres(prev => ({ ...prev, [cle]: valeur }))
    const cached = loadCache()
    if (cached) { cached.parametres = { ...(cached.parametres||{}), [cle]: valeur }; saveCache(cached) }
    try {
      const { error } = await supabase.from('parametres').upsert({ cle, valeur }, { onConflict: 'cle' })
      if (error) throw error
      return { success: true }
    } catch(e) {
      return { error: e.message }
    }
  }

  const banquesConnues = useMemo(() => {
    try {
      const stockees = JSON.parse(parametres.banques_connues || '[]')
      const vues = [...new Set(reglements.map(r => r.banque).filter(Boolean))]
      return [...new Set([...stockees, ...vues])].sort((a,b) => a.localeCompare(b))
    } catch { return [] }
  }, [parametres.banques_connues, reglements])

  const value = {
    // Données
    cours, membres, inscriptions, historique, abonnements, reglements, tarifs, parametres, saisonActive, remises, banquesConnues,
    loading, online, syncing, queueSize,
    // Actions
    loadAll,
    definirSaisonActive,
    ajouterBanque,
    creerRemises, ajouterChequesRemise, modifierStatutRemise, supprimerRemise, retirerChequeRemise,
    sauvegarderAppel,
    sauvegarderCours, supprimerCours, reactiverCours,
    sauvegarderMembre, archiverMembre, reactiverMembre,
    sauvegarderInscriptions,
    supprimerAppel,
    sauvegarderAbonnement,
    creerReglementsGroupes, creerReglementsPersonnalises, creerReglement, modifierReglement, toggleEndossement, supprimerReglement,
    sauvegarderTarif,
    importerLot,
    mettreAJourMembres,
    mettreAJourMembresLot,
    // Utilitaires
    inscritsDuCours: (coursId) => membres.filter(m => inscriptions.some(i => i.cours_id === coursId && i.membre_id === m.id)).sort((a,b) => a.nom.localeCompare(b.nom)),
    coursDuMembre: (membreId) => cours.filter(c => inscriptions.some(i => i.membre_id === membreId && i.cours_id === c.id)),
    appelsDuCours: (coursId) => historique.filter(h => h.cours_id === coursId).sort((a,b) => b.date.localeCompare(a.date)),
    appelsDuMembre: (membreId) => historique.filter(h => (h.presents||[]).includes(membreId) || (h.guests||[]).some(g => g.membreId === membreId)),
    tarifDe: (coursId, periodicite) => tarifs.find(t => t.cours_id === coursId && t.periodicite === periodicite),
    reglementsDuMembre: (membreId) => reglements.filter(r => r.membre_id === membreId).sort((a,b) => (a.date_encaissement||'').localeCompare(b.date_encaissement||'')),
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
