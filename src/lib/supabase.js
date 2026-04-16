import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ukpvsxubussqapxoyqyg.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'REMPLACER_PAR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
  realtime: { params: { eventsPerSecond: 10 } }
})
