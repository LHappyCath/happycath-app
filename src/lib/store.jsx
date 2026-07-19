import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
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
      }
      setLoading(false)
      return
    }

    try {
      const [
        { data: c }, { data: m }, { data: i }, { data: h }, { data: a }, { data: r }, { data: t }, { data: p }
      ] = await Promise.all([
        supabase.from('cours').select('*').order('jour').order('heure'),
        supabase.from('membres').select('*').order('nom'),
        supabase.from('inscriptions').select('*'),
        supabase.from('historique').select('*').order('date', { ascending: false }),
        supabase.from('abonnements').select('*'),
        supabase.from('reglements').select('*').order('date_encaissement', { ascending: false }),
        supabase.from('tarifs').select('*'),
        supabase.from('parametres').select('*'),
      ])

      const paramsObj = Object.fromEntries((p||[]).map(x => [x.cle, x.valeur]))
      const data = { cours: c||[], membres: m||[], inscriptions: i||[], historique: h||[], abonnements: a||[], reglements: r||[], tarifs: t||[], parametres: paramsObj }
      setCours(data.cours)
      setMembres(data.membres)
      setInscriptions(data.inscriptions)
      setHistorique(data.historique)
      setAbonnements(data.abonnements)
      setReglements(data.reglements)
      setTarifs(data.tarifs)
      setParametres(data.parametres)
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
    if (!navigator.onLine) return

    realtimeSub.current = supabase.channel('global_store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cours' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membres' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inscriptions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historique' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'abonnements' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reglements' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarifs' }, loadAll)
      .subscribe()

    return () => { if (realtimeSub.current) supabase.removeChannel(realtimeSub.current) }
  }, [loadAll])

  // ─── OPÉRATIONS D'ÉCRITURE ───────────────────────────────────

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
  async function insert(table, payload, localUpdate) {
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
      enqueue({ action: 'insert', table, payload })
      return { queued: true }
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
    await supabase.from('abonnements').delete().eq('membre_id', membreId).eq('saison', '2025-2026')
    if (aboData.date_debut) {
      await supabase.from('abonnements').insert({ membre_id: membreId, saison: '2025-2026', ...aboData, statut: 'actif' })
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
        id: 'r' + Date.now().toString(36) + idx,
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
        saison: p.saison || '2025-2026',
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

  // Un seul règlement (CB, espèces, virement, ou chèque isolé)
  async function creerReglement(payload) {
    const data = {
      id: 'r' + Date.now().toString(36),
      statut: payload.mode === 'CB' ? 'encaisse' : 'en_attente',
      endosse: false,
      echeance_num: 1,
      echeance_total: 1,
      source: 'direct',
      saison: '2025-2026',
      ...payload,
    }
    return insert('reglements', data, () => setReglements(prev => [data, ...prev]))
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
    const isNew = !tarifs.find(t => t.cours_id === payload.cours_id && t.periodicite === payload.periodicite && t.saison === (payload.saison||'2025-2026'))
    const data = { saison: '2025-2026', ...payload }
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

  const value = {
    // Données
    cours, membres, inscriptions, historique, abonnements, reglements, tarifs, parametres, saisonActive,
    loading, online, syncing, queueSize,
    // Actions
    loadAll,
    definirSaisonActive,
    sauvegarderAppel,
    sauvegarderCours, supprimerCours, reactiverCours,
    sauvegarderMembre, archiverMembre, reactiverMembre,
    sauvegarderInscriptions,
    supprimerAppel,
    sauvegarderAbonnement,
    creerReglementsGroupes, creerReglement, modifierReglement, toggleEndossement, supprimerReglement,
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
