import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeSub2ApiRedeemCode } from '../sub2apiRedeem.js'

const settings = {
  sub2apiRedeemEnabled: true,
  sub2apiRedeemBaseUrl: 'https://sub2api.test',
  sub2apiRedeemToken: 'TOKEN',
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('consumeSub2ApiRedeemCode', () => {
  it('skips remote requests when synchronization is disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(consumeSub2ApiRedeemCode({
      code: 'CODE-1',
      settings: { ...settings, sub2apiRedeemEnabled: false },
      userId: 'user-1',
      email: 'user@example.com',
    })).resolves.toEqual({ external: false, recovered: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the transaction marker when consuming a remote code', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 7, code: 'CODE-1', status: 'unused', value: 10 }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 9 }] } }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await consumeSub2ApiRedeemCode({
      code: 'CODE-1',
      settings,
      userId: 'user-1',
      email: 'user@example.com',
      transactionId: 'transaction-1',
      attemptCreatedAt: new Date('2026-07-24T10:00:00.000Z'),
    })

    expect(result).toMatchObject({ external: true, recovered: false, id: 7, usedBy: 9 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const postRequest = fetchMock.mock.calls[2]
    expect(postRequest[0]).toBe('https://sub2api.test/api/v1/admin/redeem-codes/create-and-redeem')
    expect(JSON.parse(String(postRequest[1]?.body))).toMatchObject({
      code: 'CODE-1',
      user_id: 9,
      notes: expect.stringContaining('transaction=transaction-1'),
    })
  })

  it('recovers a code consumed by the same pending transaction', async () => {
    const attemptCreatedAt = new Date('2026-07-24T10:00:00.000Z')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        data: {
          items: [{
            id: 7,
            code: 'CODE-1',
            status: 'used',
            used_by: 9,
            used_at: '2026-07-24T10:00:04.000Z',
            notes: 'gpt-image-playground transaction=transaction-1',
          }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 9 }] } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(consumeSub2ApiRedeemCode({
      code: 'CODE-1',
      settings,
      userId: 'user-1',
      email: 'user@example.com',
      transactionId: 'transaction-1',
      attemptCreatedAt,
    })).resolves.toMatchObject({ external: true, recovered: true, id: 7, usedBy: 9 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not recover a code that was already used before the transaction', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        data: {
          items: [{
            id: 7,
            code: 'CODE-1',
            status: 'used',
            used_by: 9,
            used_at: '2026-07-24T09:00:00.000Z',
          }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 9 }] } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(consumeSub2ApiRedeemCode({
      code: 'CODE-1',
      settings,
      userId: 'user-1',
      email: 'user@example.com',
      transactionId: 'transaction-1',
      attemptCreatedAt: new Date('2026-07-24T10:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'SUB2API_REDEEM_CODE_USED' })
  })
})
