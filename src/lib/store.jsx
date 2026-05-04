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
      }
      setLoading(false)
      return
    }

    try {
      const [
        { data: c }, { data: m }, { data: i }, { data: h }, { data: a }
      ] = await Promise.all([
        supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure'),
        supabase.from('membres').select('*').eq('actif', true).order('nom'),
        supabase.from('inscriptions').select('*'),
        supabase.from('historique').select('*').order('date', { ascending: false }),
        supabase.from('abonnements').select('*').eq('saison', '2025-2026')
      ])

      const data = { cours: c||[], membres: m||[], inscriptions: i||[], historique: h||[], abonnements: a||[] }
      setCours(data.cours)
      setMembres(data.membres)
      setInscriptions(data.inscriptions)
      setHistorique(data.historique)
      setAbonnements(data.abonnements)
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

  async function sauvegarderAppel(payload) {
    const { id, cours_id, cours_nom, date, presents, absents, guests } = payload
    const histo = { id, cours_id, cours_nom, date, presents, absents: absents || [], guests }

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
    // Suppression uniquement en ligne
    if (!navigator.onLine) return { offline: true }
    await supabase.from('cours').update({ actif: false }).eq('id', id)
    setCours(prev => prev.filter(c => c.id !== id))
    const cached = loadCache()
    if (cached) { cached.cours = (cached.cours||[]).filter(c => c.id !== id); saveCache(cached) }
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
    setMembres(prev => prev.filter(m => m.id !== id))
    const cached = loadCache()
    if (cached) { cached.membres = (cached.membres||[]).filter(m => m.id !== id); saveCache(cached) }
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

  const value = {
    // Données
    cours, membres, inscriptions, historique, abonnements,
    loading, online, syncing, queueSize,
    // Actions
    loadAll,
    sauvegarderAppel,
    sauvegarderCours, supprimerCours,
    sauvegarderMembre, archiverMembre,
    sauvegarderInscriptions,
    supprimerAppel,
    sauvegarderAbonnement,
    // Utilitaires
    inscritsDuCours: (coursId) => membres.filter(m => inscriptions.some(i => i.cours_id === coursId && i.membre_id === m.id)).sort((a,b) => a.nom.localeCompare(b.nom)),
    coursDuMembre: (membreId) => cours.filter(c => inscriptions.some(i => i.membre_id === membreId && i.cours_id === c.id)),
    appelsDuCours: (coursId) => historique.filter(h => h.cours_id === coursId).sort((a,b) => b.date.localeCompare(a.date)),
    appelsDuMembre: (membreId) => historique.filter(h => (h.presents||[]).includes(membreId) || (h.guests||[]).some(g => g.membreId === membreId)),
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
