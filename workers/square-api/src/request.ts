export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export function getBearerToken(request: Request): string | null {
  const value = request.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(value)
  return match?.[1]?.trim() || null
}

export function assertMethod(request: Request, method: string): void {
  if (request.method.toUpperCase() !== method.toUpperCase()) {
    throw new Response(null, {
      status: 405,
      headers: {
        Allow: method.toUpperCase(),
      },
    })
  }
}
