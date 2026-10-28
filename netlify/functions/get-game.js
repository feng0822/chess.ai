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
    const id = event.queryStringParameters?.id
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: '缺少 id' }) }
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
