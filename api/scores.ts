import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(res)
  }

  if (req.method === 'POST') {
    return handlePost(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(res: VercelResponse) {
  try {
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
  } catch (err) {
    console.error('Leaderboard GET error:', err)
    return res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
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
  } catch (err) {
    console.error('Leaderboard POST error:', err)
    return res.status(500).json({ error: 'Failed to submit score' })
  }
}
