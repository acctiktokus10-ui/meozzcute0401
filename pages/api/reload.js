// pages/api/reload.js
// Web bấm nút → POST /api/reload (có password) → set cờ reload=true
// Bot poll GET /api/reload → nếu cờ=true thì fetch data mới, xong reset cờ

const PASSWORD = process.env.UPLOAD_PASSWORD || 'hoantien9999'
let _store = {}

async function kvGet(key) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } })
    if (!res.ok) return null
    const json = await res.json()
    return json.result ?? null
  }
  return _store[key] ?? null
}

async function kvSet(key, value) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    })
    return res.ok
  }
  _store[key] = value
  return true
}

export default async function handler(req, res) {
  // POST — web bấm nút → set cờ reload
  if (req.method === 'POST') {
    const { password } = req.body
    if (password !== PASSWORD) return res.status(401).json({ error: 'Sai mật khẩu' })
    await kvSet('reload_flag', { pending: true, requested_at: new Date().toISOString() })
    return res.status(200).json({ success: true, message: 'Đã gửi lệnh tải dữ liệu cho bot' })
  }

  // GET — bot poll: lấy cờ + reset
  if (req.method === 'GET') {
    const flag = await kvGet('reload_flag')
    if (flag && flag.pending) {
      await kvSet('reload_flag', { pending: false, done_at: new Date().toISOString() })
      return res.status(200).json({ reload: true })
    }
    return res.status(200).json({ reload: false })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
