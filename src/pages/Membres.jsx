import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COULEURS = ['#FF0099','#8B4DB8','#1D9E75','#BA7517','#D85A30','#378ADD','#E24B4A','#0F6E56']

function initiales(nom) {
  return nom.split(' ').map(p => p[0]).join('').toUpperCase().slice(0,2)
}
function couleurMembre(id) {
  let h = 0; for (let c of id) h = (h * 31 + c.charCodeAt(0)) % COULEURS.length
  return COULEURS[h]
}

export default function Membres() {
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tous')
  const [selected, setSelected] = useState(null)
  const [ficheData, setFicheData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', abonnement: '', notes: '' })

  useEffect(() => {
    loadMembres()
    // Sync temps réel
    const sub = supabase.channel('membres').on('postgres_changes', { event: '*', schema: 'public', table: 'membres' }, () => loadMembres()).subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function loadMembres() {
    const { data } = await supabase.from('membres').select('*').eq('actif', true).order('nom')
    setMembres(data || [])
    setLoading(false)
  }

  async function openFiche(m) {
    setSelected(m)
    const { data: inscriptions } = await supabase.from('inscriptions').select('cours_id, cours(nom, heure, jour, coach)').eq('membre_id', m.id)
    const { data: reglements } = await supabase.from('reglements').select('*').eq('membre_id', m.id).order('created_at', { ascending: false })
    const { data: historique } = await supabase.from('historique').select('date, presents, cours_nom').order('date', { ascending: false }).limit(20)
    const presences = (historique || []).map(h => ({
      date: h.date, cours: h.cours_nom,
      present: Array.isArray(h.presents) && h.presents.includes(m.id)
    })).slice(0, 10)
    setFicheData({ inscriptions: inscriptions || [], reglements: reglements || [], presences })
  }

  async function saveMembre() {
    if (!form.nom.trim()) return
    const id = 'm' + Date.now().toString(36)
    await supabase.from('membres').insert({ id, ...form, actif: true })
    setShowForm(false)
    setForm({ nom: '', prenom: '', telephone: '', email: '', abonnement: '', notes: '' })
  }

  async function deleteMembre(id) {
    if (!window.confirm('Archiver ce membre ?')) return
    await supabase.from('membres').update({ actif: false }).eq('id', id)
    setSelected(null); setFicheData(null)
  }

  const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

  const filtered = membres.filter(m => {
    const s = search.toLowerCase()
    const matchSearch = m.nom.toLowerCase().includes(s) || (m.abonnement||'').toLowerCase().includes(s) || (m.prenom||'').toLowerCase().includes(s)
    const matchFilter = filter === 'tous' ||
      (filter === 'impaye') // TODO: lier aux règlements
    return matchSearch && matchFilter
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Membres</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nouveau membre</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-val" style={{ color: '#FF0099' }}>{membres.length}</div><div className="stat-lbl">Membres actifs</div></div>
        <div className="stat-card"><div className="stat-val">—</div><div className="stat-lbl">Règlements en attente</div></div>
        <div className="stat-card"><div className="stat-val">—</div><div className="stat-lbl">Nouveaux ce mois</div></div>
      </div>

      {/* Recherche + filtres */}
      <input type="text" placeholder="Rechercher un membre…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, marginBottom: 10, background: '#fff' }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['tous','Gym','Danse','Pilates','impaye'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: `0.5px solid ${filter === f ? '#FF0099' : 'rgba(0,0,0,0.15)'}`, background: filter === f ? '#FF0099' : '#fff', color: filter === f ? '#fff' : '#666', cursor: 'pointer' }}>
            {f === 'impaye' ? 'Règlement en attente' : f === 'tous' ? 'Tous' : f}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? <p style={{ color: '#888' }}>Chargement…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(m => {
            const coul = couleurMembre(m.id)
            return (
              <div key={m.id} onClick={() => openFiche(m)}
                style={{ background: '#fff', border: `0.5px solid ${selected?.id === m.id ? '#FF0099' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: coul + '20', color: coul, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flexShrink: 0 }}>{initiales(m.nom)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom}{m.prenom ? ` ${m.prenom}` : ''}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.abonnement || 'Abonnement non renseigné'}</p>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,0,153,0.1)', color: '#FF0099', flexShrink: 0 }}>Actif</span>
              </div>
            )
          })}
          {filtered.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Aucun membre trouvé</p>}
        </div>
      )}

      {/* Fiche membre */}
      {selected && ficheData && (
        <div style={{ marginTop: 20, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: couleurMembre(selected.id) + '20', color: couleurMembre(selected.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 500 }}>{initiales(selected.nom)}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 3px' }}>{selected.nom}{selected.prenom ? ` ${selected.prenom}` : ''}</p>
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{selected.abonnement || '—'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => deleteMembre(selected.id)}>Archiver</button>
              <button onClick={() => { setSelected(null); setFicheData(null) }} style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#888' }}>✕</button>
            </div>
          </div>

          {/* Infos contact */}
          {(selected.telephone || selected.email) && (
            <>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Contact</p>
              {selected.telephone && <p style={{ fontSize: 13, marginBottom: 4 }}>📞 {selected.telephone}</p>}
              {selected.email && <p style={{ fontSize: 13 }}>✉️ {selected.email}</p>}
            </>
          )}

          {/* Cours inscrits */}
          <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Cours inscrits</p>
          {ficheData.inscriptions.length === 0 ? <p style={{ fontSize: 13, color: '#888' }}>Aucun cours</p> :
            ficheData.inscriptions.map(i => (
              <div key={i.cours_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f8f8f8', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF0099', flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1 }}>{i.cours?.nom} — {JOURS[i.cours?.jour]} {i.cours?.heure}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{i.cours?.coach}</span>
              </div>
            ))}

          {/* Assiduité */}
          <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Assiduité — 10 derniers cours</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 4, marginBottom: 8 }}>
            {ficheData.presences.length === 0
              ? Array(10).fill(0).map((_,i) => <div key={i} style={{ aspectRatio: 1, borderRadius: 3, background: '#e5e5e5' }} />)
              : ficheData.presences.map((p, i) => <div key={i} title={`${p.cours} — ${p.date}`} style={{ aspectRatio: 1, borderRadius: 3, background: p.present ? '#FF0099' : '#e5e5e5' }} />)
            }
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#888' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#FF0099', marginRight: 4 }} />Présent</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#e5e5e5', marginRight: 4 }} />Absent</span>
          </div>

          {/* Règlements */}
          <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Règlements</p>
          {ficheData.reglements.length === 0 ? <p style={{ fontSize: 13, color: '#888' }}>Aucun règlement enregistré</p> :
            ficheData.reglements.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)', fontSize: 13 }}>
                <span style={{ color: '#888', fontSize: 12, minWidth: 55 }}>{r.mois ? new Date(r.mois).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '—'}</span>
                <span style={{ flex: 1 }}>{r.commentaire || r.trimestre || '—'}</span>
                <span style={{ fontWeight: 500 }}>{r.montant} €</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f0f0f0', color: '#666' }}>{r.mode}</span>
              </div>
            ))}

          {selected.notes && (
            <>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Notes</p>
              <p style={{ fontSize: 13, color: '#555', background: '#f8f8f8', borderRadius: 8, padding: '10px 12px' }}>{selected.notes}</p>
            </>
          )}
        </div>
      )}

      {/* Formulaire nouveau membre */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 500 }}>Nouveau membre</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            {[['nom','Nom *'],['prenom','Prénom'],['telephone','Téléphone'],['email','Email'],['abonnement','Cours abonnés']].map(([k, label]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 14 }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 14, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveMembre}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
