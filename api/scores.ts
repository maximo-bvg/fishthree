import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@vercel/kv'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

function getKV() {
  // @vercel/kv looks for KV_REST_API_URL and KV_REST_API_TOKEN by default,
  // but Vercel may name them with a store prefix. Try to find the right vars.
  const url = process.env.KV_REST_API_URL
    || Object.values(process.env).find(v => v?.includes('upstash.io') && v?.startsWith('https://'))
  const token = process.env.KV_REST_API_TOKEN
    || process.env.KV_REST_API_READ_ONLY_TOKEN

  if (!url || !token) {
    const kvVars = Object.keys(process.env).filter(k => k.includes('KV') || k.includes('REDIS') || k.includes('UPSTASH'))
    throw new Error(`Missing KV env vars. Found env vars matching KV/REDIS/UPSTASH: [${kvVars.join(', ')}]`)
  }

  return createClient({ url, token })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return await handleGet(res)
    }

    if (req.method === 'POST') {
      return await handlePost(req, res)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('API /api/scores error:', err?.message || err)
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

async function handleGet(res: VercelResponse) {
  const kv = getKV()
  const results = await kv.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, { rev: true, withScores: true })

  const entries = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      playerName: results[i] as string,
      totalCoinsEarned: results[i + 1] as number,
      rank: Math.floor(i / 2) + 1,
    })
  }

  return res.status(200).json(entries)
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const kv = getKV()
  const { playerName, totalCoinsEarned } = req.body ?? {}

  if (!playerName || typeof playerName !== 'string' || playerName.length < 1 || playerName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: 'Name must be 1-20 characters' })
  }

  if (typeof totalCoinsEarned !== 'number' || totalCoinsEarned <= 0) {
    return res.status(400).json({ error: 'Score must be positive' })
  }

  // Rate limiting by player name
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${playerName}`
  const existing = await kv.get(rateLimitKey)
  if (existing) {
    return res.status(429).json({ error: 'Rate limited. Try again in a minute.' })
  }

  await kv.zadd(LEADERBOARD_KEY, { score: totalCoinsEarned, member: playerName })
  await kv.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS })

  return res.status(200).json({ success: true })
}
