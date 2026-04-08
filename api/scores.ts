import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from 'redis'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

async function getRedis() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('Missing REDIS_URL env var')
  }
  const client = createClient({ url })
  await client.connect()
  return client
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let redis: Awaited<ReturnType<typeof getRedis>> | null = null
  try {
    redis = await getRedis()

    if (req.method === 'GET') {
      return await handleGet(redis, res)
    }
    if (req.method === 'POST') {
      return await handlePost(redis, req, res)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('API /api/scores error:', err?.message || err)
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  } finally {
    await redis?.disconnect()
  }
}

async function handleGet(redis: Awaited<ReturnType<typeof getRedis>>, res: VercelResponse) {
  const results = await redis.zRangeWithScores(LEADERBOARD_KEY, 0, TOP_N - 1, { REV: true })

  const entries = results.map((item, i) => ({
    playerName: item.value,
    totalCoinsEarned: item.score,
    rank: i + 1,
  }))

  return res.status(200).json(entries)
}

async function handlePost(redis: Awaited<ReturnType<typeof getRedis>>, req: VercelRequest, res: VercelResponse) {
  const { playerName, totalCoinsEarned } = req.body ?? {}

  if (!playerName || typeof playerName !== 'string' || playerName.length < 1 || playerName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: 'Name must be 1-20 characters' })
  }

  if (typeof totalCoinsEarned !== 'number' || totalCoinsEarned <= 0) {
    return res.status(400).json({ error: 'Score must be positive' })
  }

  // Rate limiting by player name
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${playerName}`
  const existing = await redis.get(rateLimitKey)
  if (existing) {
    return res.status(429).json({ error: 'Rate limited. Try again in a minute.' })
  }

  await redis.zAdd(LEADERBOARD_KEY, [{ score: totalCoinsEarned, value: playerName }])
  await redis.set(rateLimitKey, '1', { EX: RATE_LIMIT_SECONDS })

  return res.status(200).json({ success: true })
}
