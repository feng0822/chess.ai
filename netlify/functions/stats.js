import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

function authClient(event) {
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

export default async (event) => {
  const supabase = authClient(event)
  if (!supabase) return { statusCode: 401, body: JSON.stringify({ error: '请先登录' }) }
  try {
    const { data, error } = await supabase
      .from('games')
      .select('result, difficulty')
    if (error) throw error
    const total = data.length
    const win = data.filter(g => g.result === 'win').length
    const lose = data.filter(g => g.result === 'lose').length
    const draw = data.filter(g => g.result === 'draw').length
    return {
      statusCode: 200,
      body: JSON.stringify({
        total, win, lose, draw,
        winRate: total ? Math.round(win / total * 100) : 0
      })
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
