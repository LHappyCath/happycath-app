// Cours & Appel
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

export function Cours() {
  const [cours, setCours] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const appelCoursId = searchParams.get('appel')

  useEffect(() => {
    loadCours()
    const sub = supabase.channel('cours').on('postgres_changes', { event: '*', schema: 'public', table: 'cours' }, loadCours).subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function loadCours() {
    const { data } = await supabase.from('cours').select('*').eq('actif', true).order('jour').order('heure')
    setCours(data || [])
    setLoading(false)
  }

  const coursByJour = JOURS.map((j, i) => ({ jour: j, idx: i, cours: cours.filter(c => c.jour === i) })).filter(g => g.cours.length > 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cours & appel</h1>
        <button className="btn btn-primary">+ Nouveau cours</button>
      </div>
      {loading ? <p style={{ color: '#888' }}>Chargement…</p> : coursByJour.map(g => (
        <div key={g.jour} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{g.jour}</p>
          {g.cours.map(c => (
            <div key={c.id} style={{ background: '#fff', border: `0.5px solid ${appelCoursId === c.id ? '#FF0099' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 3px' }}>{c.nom}</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{c.heure} · {c.duree} · {c.coach}</p>
              </div>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>Faire l'appel</button>
            </div>
          ))}
        </div>
      ))}
      {coursByJour.length === 0 && !loading && <p style={{ color: '#888' }}>Aucun cours configuré. Ajoutez votre premier cours !</p>}
    </div>
  )
}

export function Reglements() {
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Règlements</h1><button style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 }}>+ Nouveau règlement</button></div>
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <p style={{ fontSize:32, marginBottom:12 }}>💶</p>
        <p style={{ fontWeight:500, marginBottom:6 }}>Module règlements</p>
        <p style={{ color:'#888', fontSize:14 }}>Chèques, espèces, remises banque — en cours de développement</p>
      </div>
    </div>
  )
}

export function Budget() {
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Budget & finances</h1></div>
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <p style={{ fontSize:32, marginBottom:12 }}>📊</p>
        <p style={{ fontWeight:500, marginBottom:6 }}>Module budget</p>
        <p style={{ color:'#888', fontSize:14 }}>Prévisionnel, réel, trésorerie, impôt EI — en cours de développement</p>
      </div>
    </div>
  )
}

export function Factures() {
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Factures</h1><button style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#FF0099', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 }}>+ Nouvelle facture</button></div>
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <p style={{ fontSize:32, marginBottom:12 }}>🧾</p>
        <p style={{ fontWeight:500, marginBottom:6 }}>Module factures</p>
        <p style={{ color:'#888', fontSize:14 }}>Établir, envoyer, suivre — en cours de développement</p>
      </div>
    </div>
  )
}
