import { getConfig } from '../config'
import { createId, createToken } from '../crypto'
import { enforceRateLimit, hashToken } from '../db'
import { getClientIp } from '../request'
import { jsonOk } from '../response'
import type { RequestContext } from '../types'

export async function handleCreateIdentity(ctx: RequestContext): Promise<Response> {
  const config = getConfig(ctx.env)
  const ip = getClientIp(ctx.request)
  await enforceRateLimit(
    ctx.env,
    `identity:ip:${ip}`,
    config.ipIdentityRateLimitPerHour,
    60 * 60 * 1000,
  )

  const publisherId = createId('pub')
  const token = createToken()
  const tokenHash = await hashToken(ctx.env, token)
  const now = Date.now()

  await ctx.env.DB.prepare(
    `INSERT INTO publishers (id, token_hash, created_at, last_seen_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(publisherId, tokenHash, now, now)
    .run()

  return jsonOk(
    {
      publisherId,
      token,
    },
    { status: 201 },
    ctx.corsHeaders,
  )
}
