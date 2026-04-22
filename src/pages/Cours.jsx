import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const JOURS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function initiales(nom) {
  return (nom || '').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

const BTN = {
  primary: { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#FF0099', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  outline: { padding: '9px 18px', borderRadius: 8, border: '1px solid #FF0099', background: 'transparent', color: '#FF0099', cursor: 'pointer', fontSize: 14 },
  ghost: { padding: '9px 18px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 14 },
}

const INPUT = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 14, background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' }

function Modal({ titre, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{titre}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormCours({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { nom: '', jour: 1, heure: '09h00', duree: '60min', coach: '', capacite_max: 15 })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.nom.trim() || !form.coach.trim()) return
    setSaving(true)
    const payload = { nom: form.nom, jour: parseInt(form.jour), heure: form.heure, duree: form.duree, coach: form.coach, capacite_max: parseInt(form.capacite_max) || 15 }
    if (initial?.id) {
      await supabase.from('cours').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('cours').insert({ id: 'c' + Date.now().toString(36), ...payload, actif: true })
    }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Nom du cours *</label>
        <input style={INPUT} value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="ex: Pilates, Body Training…" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Jour *</label>
          <select style={{ ...INPUT }} value={form.jour} onChange={e => set('jour', e.target.value)}>
            {JOURS_FULL.map((j, i) => <option key={i} value={i}>{j}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Heure *</label>
          <input style={INPUT} value={form.heure} onChange={e => set('heure', e.target.value)} placeholder="09h00" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Durée</label>
          <input style={INPUT} value={form.duree} onChange={e => set('duree', e.target.value)} placeholder="60min" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Coach *</label>
          <input style={INPUT} value={form.coach} onChange={e => set('coach', e.target.value)} placeholder="Prénom" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Places max</label>
          <input style={INPUT} type="number" min="1" max="100" value={form.capacite_max || 15} onChange={e => set('capacite_max', e.target.value)} placeholder="15" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button style={{ ...BTN.ghost, flex: 1 }} onClick={onClose}>Annuler</button>
        <button style={{ ...BTN.primary, flex: 2, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer le cours'}
        </button>
      </div>
    </div>
  )
}

function Planning({ cours, onStartAppel, onVoirHistorique, onEditCours, onDeleteCours, onNouveauCours }) {
  const aujourdJour = new Date().getDay()
  const [jourActif, setJourActif] = useState(aujourdJour)

  const coursDuJour = [...cours].filter(c => c.jour === jourActif).sort((a, b) => a.heure.localeCompare(b.heure))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cours & appel</h1>
        <button style={BTN.primary} onClick={onNouveauCours}>+ Nouveau cours</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
        {JOURS.map((j, i) => {
          const hasCours = cours.some(c => c.jour === i)
          const isToday = i === aujourdJour
          const isActif = i === jourActif
          return (
            <button key={i} onClick={() => setJourActif(i)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${isActif ? '#FF0099' : isToday ? 'rgba(255,0,153,0.3)' : 'rgba(0,0,0,0.1)'}`, background: isActif ? '#FF0099' : 'transparent', color: isActif ? '#fff' : isToday ? '#FF0099' : '#666', cursor: 'pointer', fontSize: 13, fontWeight: isToday || isActif ? 500 : 400, position: 'relative' }}>
              {j}
              {hasCours && <span style={{ position: 'absolute', top: 3, right: 3, width: 4, height: 4, borderRadius: '50%', background: isActif ? 'rgba(255,255,255,0.8)' : '#FF0099' }} />}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{JOURS_FULL[jourActif]}</p>
        {jourActif === aujourdJour && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,0,153,0.1)', color: '#FF0099', fontWeight: 500 }}>Aujourd'hui</span>}
      </div>
      {coursDuJour.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>📋</p>
          <p style={{ fontSize: 14, marginBottom: 12 }}>Aucun cours ce jour</p>
          <button style={{ ...BTN.outline, fontSize: 13 }} onClick={onNouveauCours}>+ Ajouter un cours</button>
        </div>
      ) : coursDuJour.map(c => (
        <div key={c.id} style={{ background: '#fff', border: `0.5px solid ${jourActif === aujourdJour ? 'rgba(255,0,153,0.15)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ textAlign: 'center', minWidth: 52, paddingTop: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{c.heure}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{c.duree}</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 3px' }}>{c.nom}</p>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>{c.coach} · {c.nb_inscrits || 0} inscrit{c.nb_inscrits !== 1 ? 's' : ''}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => onStartAppel(c)} style={{ ...BTN.primary, fontSize: 12, padding: '6px 14px' }}>
                  {jourActif === aujourdJour ? "Faire l'appel" : 'Appel rétroactif'}
                </button>
                <button onClick={() => onVoirHistorique(c)} style={{ ...BTN.ghost, fontSize: 12, padding: '6px 12px' }}>Historique</button>
                <button onClick={() => onEditCours(c)} style={{ ...BTN.ghost, fontSize: 12, padding: '6px 12px' }}>Modifier</button>
                <button onClick={() => onDeleteCours(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#ccc', padding: '6px 8px' }}>Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EcranAppel({ cours, tousLesMembres, onValider, onAnnuler, appelExistant }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(appelExistant?.date || today)
  const [inscrits, setInscrits] = useState([])
  const [presents, setPresents] = useState(new Set(appelExistant?.presents || []))
  const [showRattrapage, setShowRattrapage] = useState(false)
  const [showEssai, setShowEssai] = useState(false)
  const [searchRattrapage, setSearchRattrapage] = useState('')
  const [rattrapages, setRattrapages] = useState((appelExistant?.guests || []).filter(g => g.type === 'rattrapage').map(g => ({ id: g.membreId, nom: g.nom })))
  const [essais, setEssais] = useState((appelExistant?.guests || []).filter(g => g.type === 'essai'))
  const [nomEssai, setNomEssai] = useState('')
  const [saving, setSaving] = useState(false)
  const [doublonInfo, setDoublonInfo] = useState(null)

  useEffect(() => {
    // Hors ligne : reconstruire les inscrits depuis le cache cours+membres
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem('happycath_cours_cache') || 'null')
        if (cached) {
          // Charger les inscriptions depuis le cache des inscriptions
          const inscCache = JSON.parse(localStorage.getItem('happycath_inscriptions_cache') || 'null') || []
          const inscritIds = inscCache.filter(i => i.cours_id === cours.id).map(i => i.membre_id)
          const membres = (cached.membres || []).filter(m => inscritIds.includes(m.id)).sort((a, b) => a.nom.localeCompare(b.nom))
          setInscrits(membres)
          return
        }
      } catch(e) {}
      return
    }
    supabase.from('inscriptions').select('membre_id, membres(id, nom, abonnement)').eq('cours_id', cours.id)
      .then(({ data }) => {
        const list = (data || []).map(i => i.membres).filter(Boolean).sort((a, b) => a.nom.localeCompare(b.nom))
        setInscrits(list)
        // Sauvegarder toutes les inscriptions en cache
        supabase.from('inscriptions').select('cours_id, membre_id').then(({ data: allInsc }) => {
          if (allInsc) {
            try { localStorage.setItem('happycath_inscriptions_cache', JSON.stringify(allInsc)) } catch(e) {}
          }
        })
      })
  }, [cours.id])

  function togglePresent(id) {
    setPresents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function addRattrapage(m) {
    if (rattrapages.find(r => r.id === m.id)) return
    setRattrapages(prev => [...prev, m].sort((a, b) => a.nom.localeCompare(b.nom)))
    setPresents(prev => new Set([...prev, m.id]))
    setShowRattrapage(false); setSearchRattrapage('')
  }

  function addEssai() {
    if (!nomEssai.trim()) return
    setEssais(prev => [...prev, { id: 'essai_' + Date.now(), nom: nomEssai.trim(), type: 'essai' }])
    setNomEssai(''); setShowEssai(false)
  }

  async function handleValider() {
    setSaving(true)
    if (!appelExistant) {
      // Hors ligne : pas de vérification doublon, on sauvegarde en local
      if (!navigator.onLine) {
        await sauvegarder(null)
        setSaving(false)
        return
      }
      const { data: doublon } = await supabase.from('historique').select('id,presents,guests').eq('cours_id', cours.id).eq('date', date).maybeSingle()
      if (doublon) { setDoublonInfo(doublon); setSaving(false); return }
    }
    await sauvegarder(appelExistant?.id)
    setSaving(false)
  }

  async function sauvegarder(idExistant) {
    const presentsArr = [...presents]
    const guests = [...rattrapages.map(r => ({ nom: r.nom, membreId: r.id, type: 'rattrapage' })), ...essais.map(e => ({ nom: e.nom, membreId: null, type: 'essai' }))]
    await onValider({ id: idExistant, coursId: cours.id, coursNom: cours.nom, date, presents: presentsArr, guests })
  }

  const inscritIds = new Set(inscrits.map(m => m.id))
  const rattrapageIds = new Set(rattrapages.map(r => r.id))
  const membresDispo = tousLesMembres.filter(m => !inscritIds.has(m.id) && !rattrapageIds.has(m.id) && m.nom.toLowerCase().includes(searchRattrapage.toLowerCase()))
  const nbPresents = presents.size + essais.length
  const nbTotal = inscrits.length + rattrapages.length + essais.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onAnnuler} style={{ ...BTN.ghost, padding: '8px 14px', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 2px' }}>{cours.nom}</h2>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{cours.heure} · {cours.coach}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#FF0099' }}>{nbPresents}<span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}>/{nbTotal}</span></div>
          <div style={{ fontSize: 11, color: '#aaa' }}>présents</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#888', flex: 1 }}>Date du cours</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ border: 'none', fontSize: 14, fontWeight: 500, background: 'transparent', color: '#1a1a1a', cursor: 'pointer' }} />
      </div>

      {doublonInfo && (
        <div style={{ background: '#fff8e6', border: '1px solid #f59e0b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#92400e' }}>⚠️ Un appel existe déjà pour cette date</p>
          <p style={{ fontSize: 13, color: '#78350f', marginBottom: 14 }}>Que souhaitez-vous faire ?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { setDoublonInfo(null); onAnnuler() }} style={{ ...BTN.ghost, width: '100%', padding: '10px 14px', textAlign: 'left' }}>Ouvrir l'existant sans modifier</button>
            <button onClick={async () => { setDoublonInfo(null); setSaving(true); await sauvegarder(doublonInfo.id); setSaving(false) }} style={{ ...BTN.primary, width: '100%', padding: '10px 14px' }}>Remplacer par le nouvel appel</button>
            <button onClick={() => setDoublonInfo(null)} style={{ ...BTN.ghost, width: '100%', padding: '10px 14px', textAlign: 'left' }}>Annuler — ne rien changer</button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Inscrits ({inscrits.length})</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
        {inscrits.length === 0 && <p style={{ fontSize: 13, color: '#aaa', padding: '10px 0' }}>Aucun inscrit — gérez les inscriptions depuis le module Membres</p>}
        {inscrits.map(m => {
          const est = presents.has(m.id)
          return (
            <div key={m.id} onClick={() => togglePresent(m.id)} style={{ background: est ? 'rgba(255,0,153,0.05)' : '#fff', border: `1.5px solid ${est ? '#FF0099' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: est ? '#FF0099' : '#f0f0f0', color: est ? '#fff' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                {est ? '✓' : initiales(m.nom)}
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: est ? 500 : 400 }}>{m.nom}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: est ? '#FF0099' : '#ccc' }}>{est ? 'Présent' : 'Absent'}</span>
            </div>
          )
        })}
      </div>

      {rattrapages.length > 0 && <>
        <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Rattrapages ({rattrapages.length})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {rattrapages.map(m => (
            <div key={m.id} style={{ background: 'rgba(204,255,0,0.07)', border: '1.5px solid #aad000', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#aad000', color: '#3a5000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flexShrink: 0 }}>✓</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{m.nom}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(204,255,0,0.2)', color: '#3a5000' }}>Rattrapage</span>
              <button onClick={() => { setRattrapages(prev => prev.filter(r => r.id !== m.id)); setPresents(prev => { const n = new Set(prev); n.delete(m.id); return n }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      {essais.length > 0 && <>
        <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Essais / externes ({essais.length})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {essais.map(e => (
            <div key={e.id} style={{ background: 'rgba(55,138,221,0.05)', border: '1.5px solid #85b7eb', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#85b7eb', color: '#042c53', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flexShrink: 0 }}>?</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{e.nom}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(55,138,221,0.12)', color: '#185fa5' }}>Essai</span>
              <button onClick={() => setEssais(prev => prev.filter(x => x.id !== e.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowRattrapage(!showRattrapage); setShowEssai(false) }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px dashed #aad000', background: showRattrapage ? 'rgba(204,255,0,0.1)' : 'transparent', color: '#3a5000', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ Rattrapage</button>
        <button onClick={() => { setShowEssai(!showEssai); setShowRattrapage(false) }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px dashed #85b7eb', background: showEssai ? 'rgba(55,138,221,0.08)' : 'transparent', color: '#185fa5', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ Essai / externe</button>
      </div>

      {showRattrapage && (
        <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <input type="text" placeholder="Rechercher un membre de la salle…" value={searchRattrapage} onChange={e => setSearchRattrapage(e.target.value)} style={{ ...INPUT, marginBottom: 8 }} autoFocus />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {membresDispo.slice(0, 30).map(m => (
              <div key={m.id} onClick={() => addRattrapage(m)} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, border: '0.5px solid rgba(0,0,0,0.07)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>{initiales(m.nom)}</div>
                <span style={{ flex: 1 }}>{m.nom}</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>{m.abonnement || ''}</span>
              </div>
            ))}
            {membresDispo.length === 0 && <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: 8 }}>Aucun membre trouvé</p>}
          </div>
        </div>
      )}

      {showEssai && (
        <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Nom et prénom" value={nomEssai} onChange={e => setNomEssai(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEssai()} style={{ ...INPUT, flex: 1 }} autoFocus />
            <button onClick={addEssai} style={{ ...BTN.primary, whiteSpace: 'nowrap' }}>Ajouter</button>
          </div>
        </div>
      )}

      <button onClick={handleValider} disabled={saving} style={{ ...BTN.primary, width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginBottom: 8, opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Enregistrement…' : `✓ Valider l'appel — ${nbPresents} présent${nbPresents > 1 ? 's' : ''}`}
      </button>
      <button onClick={onAnnuler} style={{ ...BTN.ghost, width: '100%', padding: 11, borderRadius: 12 }}>Annuler</button>
    </div>
  )
}

function HistoriqueCours({ cours, tousLesMembres, onRetour, onEditer, onSupprimerAppel }) {
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadHisto = useCallback(async () => {
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem('happycath_histo_cache') || '[]')
        const filtered = cached.filter(h => h.cours_id === cours.id)
        setHistorique(filtered)
      } catch(e) { setHistorique([]) }
      setLoading(false)
      return
    }
    const { data } = await supabase.from('historique').select('*').eq('cours_id', cours.id).order('date', { ascending: false })
    // Mettre à jour le cache historique
    try {
      const allCache = JSON.parse(localStorage.getItem('happycath_histo_cache') || '[]')
      const autresCours = allCache.filter(h => h.cours_id !== cours.id)
      localStorage.setItem('happycath_histo_cache', JSON.stringify([...(data||[]), ...autresCours]))
    } catch(e) {}
    setHistorique(data || [])
    setLoading(false)
  }, [cours.id])

  useEffect(() => { loadHisto() }, [loadHisto])

  function getNom(id) { return tousLesMembres.find(m => m.id === id)?.nom || id }

  const filtered = historique.filter(h => {
    const s = search.toLowerCase()
    return !s || (h.cours_nom || '').toLowerCase().includes(s) || (h.date || '').includes(s)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onRetour} style={{ ...BTN.ghost, padding: '8px 14px', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 2px' }}>Historique — {cours.nom}</h2>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{historique.length} appel{historique.length > 1 ? 's' : ''}</p>
        </div>
      </div>
      <input type="text" placeholder="Rechercher par date ou nom…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...INPUT, marginBottom: 14 }} />
      {loading ? <p style={{ color: '#888', fontSize: 14 }}>Chargement…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(h => {
            const presentsNoms = (h.presents || []).map(id => getNom(id))
            const rattrapages = (h.guests || []).filter(g => g.type === 'rattrapage')
            const essais = (h.guests || []).filter(g => g.type === 'essai')
            const nbTotal = presentsNoms.length + (h.guests || []).length
            const dateStr = new Date(h.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
            return (
              <div key={h.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 3px', textTransform: 'capitalize' }}>{dateStr}</p>
                    <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                      {nbTotal} présent{nbTotal > 1 ? 's' : ''}
                      {rattrapages.length > 0 && ` · ${rattrapages.length} rattrapage${rattrapages.length > 1 ? 's' : ''}`}
                      {essais.length > 0 && ` · ${essais.length} essai${essais.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEditer(h)} style={{ ...BTN.ghost, fontSize: 12, padding: '5px 10px' }}>Modifier</button>
                    <button onClick={() => onSupprimerAppel(h.id, loadHisto)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '5px 4px' }}>🗑</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {presentsNoms.map((nom, i) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,0,153,0.08)', color: '#FF0099' }}>{nom}</span>)}
                  {rattrapages.map((r, i) => <span key={'r' + i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(204,255,0,0.15)', color: '#3a5000' }}>{r.nom} ↩</span>)}
                  {essais.map((e, i) => <span key={'e' + i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(55,138,221,0.1)', color: '#185fa5' }}>{e.nom} ✦</span>)}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p style={{ color: '#aaa', fontSize: 14, textAlign: 'center', padding: 24 }}>Aucun appel trouvé</p>}
        </div>
      )}
    </div>
  )
}

export default function Cours() {
  const [searchParams] = useSearchParams()
  const [vue, setVue] = useState('planning')
  const [cours, setCours] = useState([])
  const [tousLesMembres, setTousLesMembres] = useState([])
  const [coursSelectionne, setCoursSelectionne] = useState(null)
  const [appelExistant, setAppelExistant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [modalCours, setModalCours] = useState(null)

  const CACHE_KEY = 'happycath_cours_cache'

  const loadData = useCallback(async () => {
    // Si hors ligne, utiliser le cache localStorage
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached) {
          setCours(cached.cours || [])
          setTousLesMembres(cached.membres || [])
          setLoading(false)
          return
        }
      } catch(e) {}
      setLoading(false)
      return
    }
    const [{ data: coursData }, { data: membresData }] = await Promise.all([
      supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure'),
      supabase.from('membres').select('id, nom, abonnement').eq('actif', true).order('nom')
    ])
    const avecNb = await Promise.all((coursData || []).map(async c => {
      const { count } = await supabase.from('inscriptions').select('*', { count: 'exact' }).eq('cours_id', c.id)
      return { ...c, nb_inscrits: count || 0 }
    }))

    // Pré-charger inscriptions + historique complet pour le mode hors ligne
    const [{ data: toutesInscriptions }, { data: toutHistorique }] = await Promise.all([
      supabase.from('inscriptions').select('cours_id, membre_id'),
      supabase.from('historique').select('*').order('date', { ascending: false })
    ])

    // Sauvegarder TOUT en cache
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ cours: avecNb, membres: membresData || [], timestamp: Date.now() }))
      localStorage.setItem('happycath_inscriptions_cache', JSON.stringify(toutesInscriptions || []))
      localStorage.setItem('happycath_histo_cache', JSON.stringify(toutHistorique || []))
      localStorage.setItem('happycath_membres_cache', JSON.stringify({ membres: membresData || [], cours: coursData || [], timestamp: Date.now() }))
    } catch(e) {}

    setCours(avecNb)
    setTousLesMembres(membresData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    // Realtime seulement si en ligne
    if (!navigator.onLine) return
    const sub = supabase.channel('cours_ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cours' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [loadData])

  useEffect(() => {
    const id = searchParams.get('appel')
    if (id && cours.length > 0) {
      const c = cours.find(x => x.id === id)
      if (c) startAppel(c)
    }
  }, [cours, searchParams])

  async function startAppel(c) {
    setCoursSelectionne(c)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('historique').select('*').eq('cours_id', c.id).eq('date', today).maybeSingle()
    setAppelExistant(data || null)
    setVue('appel')
  }

  async function validerAppel({ id, coursId, coursNom, date, presents, guests }) {
    const hId = id || ('h' + Date.now().toString(36))
    const payload = { id: hId, cours_id: coursId, cours_nom: coursNom, date, presents, guests }

    if (!navigator.onLine) {
      // Sauvegarder dans la file d'attente locale
      try {
        const queue = JSON.parse(localStorage.getItem('happycath_sync_queue') || '[]')
        queue.push({ type: id ? 'update' : 'insert', table: 'historique', payload, timestamp: Date.now() })
        localStorage.setItem('happycath_sync_queue', JSON.stringify(queue))
        // Aussi mettre à jour le cache local de l'historique
        const histoCache = JSON.parse(localStorage.getItem('happycath_histo_cache') || '[]')
        const idx = histoCache.findIndex(h => h.id === hId)
        if (idx >= 0) histoCache[idx] = payload; else histoCache.unshift(payload)
        localStorage.setItem('happycath_histo_cache', JSON.stringify(histoCache))
      } catch(e) {}
      showToast(`Appel sauvegardé localement — sera synchronisé dès le retour du réseau`)
      setVue('planning'); setCoursSelectionne(null); setAppelExistant(null)
      return
    }

    if (id) {
      await supabase.from('historique').update(payload).eq('id', id)
    } else {
      await supabase.from('historique').insert(payload)
    }

    // Synchroniser la file d'attente si elle existe
    try {
      const queue = JSON.parse(localStorage.getItem('happycath_sync_queue') || '[]')
      if (queue.length > 0) {
        for (const item of queue) {
          if (item.type === 'insert') await supabase.from(item.table).insert(item.payload)
          if (item.type === 'update') await supabase.from(item.table).update(item.payload).eq('id', item.payload.id)
        }
        localStorage.removeItem('happycath_sync_queue')
        showToast(`Appel enregistré + ${queue.length} appel(s) hors ligne synchronisé(s)`)
      } else {
        showToast(`Appel enregistré — ${presents.length + guests.length} présent(s)`)
      }
    } catch(e) {
      showToast(`Appel enregistré — ${presents.length + guests.length} présent(s)`)
    }

    setVue('planning'); setCoursSelectionne(null); setAppelExistant(null)
    loadData()
  }

  async function supprimerCours(c) {
    if (!window.confirm(`Supprimer le cours "${c.nom}" ?`)) return
    await supabase.from('cours').update({ actif: false }).eq('id', c.id)
    showToast('Cours supprimé'); loadData()
  }

  async function supprimerAppel(id, reload) {
    if (!window.confirm('Supprimer cet appel définitivement ?')) return
    await supabase.from('historique').delete().eq('id', id)
    showToast('Appel supprimé'); reload()
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  if (loading) return <div style={{ padding: 20, color: '#888', fontSize: 14 }}>Chargement…</div>

  return (
    <div>
      {vue === 'planning' && (
        <Planning cours={cours} onStartAppel={startAppel}
          onVoirHistorique={c => { setCoursSelectionne(c); setVue('historique') }}
          onEditCours={c => setModalCours(c)}
          onDeleteCours={supprimerCours}
          onNouveauCours={() => setModalCours('nouveau')} />
      )}
      {vue === 'appel' && coursSelectionne && (
        <EcranAppel cours={coursSelectionne} tousLesMembres={tousLesMembres} appelExistant={appelExistant}
          onValider={validerAppel}
          onAnnuler={() => { setVue('planning'); setCoursSelectionne(null); setAppelExistant(null) }} />
      )}
      {vue === 'historique' && coursSelectionne && (
        <HistoriqueCours cours={coursSelectionne} tousLesMembres={tousLesMembres}
          onRetour={() => { setVue('planning'); setCoursSelectionne(null) }}
          onEditer={h => { setAppelExistant(h); setCoursSelectionne(cours.find(c => c.id === h.cours_id) || coursSelectionne); setVue('appel') }}
          onSupprimerAppel={supprimerAppel} />
      )}

      {modalCours && (
        <Modal titre={modalCours === 'nouveau' ? 'Nouveau cours' : `Modifier — ${modalCours.nom}`} onClose={() => setModalCours(null)}>
          <FormCours initial={modalCours === 'nouveau' ? null : modalCours}
            onSave={() => { setModalCours(null); loadData(); showToast(modalCours === 'nouveau' ? 'Cours créé !' : 'Cours modifié !') }}
            onClose={() => setModalCours(null)} />
        </Modal>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, fontWeight: 500, zIndex: 400, whiteSpace: 'nowrap' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
