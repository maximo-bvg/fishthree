import { kv } from '@vercel/kv'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

interface LeaderboardEntry {
  playerName: string
  totalCoinsEarned: number
  rank: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return handleGet()
  }

  if (req.method === 'POST') {
    return handlePost(req)
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleGet(): Promise<Response> {
  const results = await kv.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, { rev: true, withScores: true })

  const entries: LeaderboardEntry[] = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      playerName: results[i] as string,
      totalCoinsEarned: results[i + 1] as number,
      rank: Math.floor(i / 2) + 1,
    })
  }

  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handlePost(req: Request): Promise<Response> {
  let body: { playerName?: string; totalCoinsEarned?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { playerName, totalCoinsEarned } = body
  if (!playerName || typeof playerName !== 'string' || playerName.length < 1 || playerName.length > MAX_NAME_LENGTH) {
    return new Response(JSON.stringify({ error: 'Name must be 1-20 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (typeof totalCoinsEarned !== 'number' || totalCoinsEarned <= 0) {
    return new Response(JSON.stringify({ error: 'Score must be positive' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting by player name
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${playerName}`
  const existing = await kv.get(rateLimitKey)
  if (existing) {
    return new Response(JSON.stringify({ error: 'Rate limited. Try again in a minute.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await kv.zadd(LEADERBOARD_KEY, { score: totalCoinsEarned, member: playerName })
  await kv.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS })

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
