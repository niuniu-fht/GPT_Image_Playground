export function jsonOk<T>(data: T, init: ResponseInit = {}, corsHeaders: HeadersInit = {}): Response {
  return jsonResponse(
    {
      ok: true,
      data,
    },
    init,
    corsHeaders,
  )
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  requestId: string,
  corsHeaders: HeadersInit = {},
): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        requestId,
      },
    },
    { status },
    corsHeaders,
  )
}

function jsonResponse(payload: unknown, init: ResponseInit, corsHeaders: HeadersInit): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  for (const [key, value] of new Headers(corsHeaders)) {
    headers.set(key, value)
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  })
}
