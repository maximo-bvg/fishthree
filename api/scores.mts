import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

function getRedis() {
  const url = process.env.REDIS_URL
  const token = process.env.REDIS_TOKEN
  if (!url || !token) {
    const vars = Object.keys(process.env).filter(k => k.includes('REDIS') || k.includes('UPSTASH') || k.includes('KV'))
    throw new Error(`Missing REDIS_URL or REDIS_TOKEN. Found: [${vars.join(', ')}]`)
  }
  return new Redis({ url, token })
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
  const redis = getRedis()
  const results = await redis.zrange<string[]>(LEADERBOARD_KEY, 0, TOP_N - 1, { rev: true, withScores: true })

  const entries = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      playerName: results[i],
      totalCoinsEarned: Number(results[i + 1]),
      rank: Math.floor(i / 2) + 1,
    })
  }

  return res.status(200).json(entries)
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis()
  const { playerName, totalCoinsEarned } = req.body ?? {}

  if (!playerName || typeof playerName !== 'string' || playerName.length < 1 || playerName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: 'Name must be 1-20 characters' })
  }

  if (typeof totalCoinsEarned !== 'number' || totalCoinsEarned <= 0) {
    return res.status(400).json({ error: 'Score must be positive' })
  }

  const rateLimitKey = `${RATE_LIMIT_PREFIX}${playerName}`
  const existing = await redis.get(rateLimitKey)
  if (existing) {
    return res.status(429).json({ error: 'Rate limited. Try again in a minute.' })
  }

  await redis.zadd(LEADERBOARD_KEY, { score: totalCoinsEarned, member: playerName })
  await redis.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS })

  return res.status(200).json({ success: true })
}
