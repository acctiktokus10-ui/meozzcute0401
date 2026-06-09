// pages/api/data/[type].js
// Bot gọi GET /api/data/donhang hoặc /api/data/vitien để lấy dữ liệu

let _store = {}

async function kvGet(key) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.result ?? null
  }
  return _store[key] ?? null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type } = req.query
  if (!['donhang', 'vitien'].includes(type)) {
    return res.status(400).json({ error: 'type phải là donhang hoặc vitien' })
  }

  const key = `${type}_by_subid`
  const data = await kvGet(key)

  if (data === null) {
    return res.status(404).json({ error: `Chưa có dữ liệu ${type}` })
  }

  // Set cache header ngắn để bot luôn lấy mới nhất
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(data)
}
