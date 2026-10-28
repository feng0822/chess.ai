import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

// 从请求头拿用户 JWT，创建"带登录身份"的 Supabase 客户端
function authClient(event) {
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

export default async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }
  const supabase = authClient(event)
  if (!supabase) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先登录' }) }
  }
  try {
    const body = JSON.parse(event.body || '{}')
    const { result, difficulty, moves, final_fen } = body
    if (!['win', 'lose', 'draw'].includes(result)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'result 必须是 win/lose/draw' }) }
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('games')
      .insert({ user_id: user.id, result, difficulty, moves, final_fen })
      .select()
      .single()
    if (error) throw error
    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
