import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildGeminiGenerateContentEndpoint,
  callGeminiGenerateContent,
  resolveGeminiImageConfig,
} from '../geminiApi.js'

describe('Gemini native image adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds the native generateContent endpoint without changing the stored model id', () => {
    expect(buildGeminiGenerateContentEndpoint(
      'https://generativelanguage.googleapis.com/v1beta/',
      'models/gemini-3-pro-image-preview',
    )).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
    )
  })

  it('maps playground sizes to Gemini aspect ratio and image size', () => {
    expect(resolveGeminiImageConfig('2048x1152')).toEqual({
      aspectRatio: '16:9',
      imageSize: '2K',
    })
    expect(resolveGeminiImageConfig('3840x3840')).toEqual({
      aspectRatio: '1:1',
      imageSize: '4K',
    })
  })

  it('sends reference images and extracts inline image output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }],
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGeminiGenerateContent({
      apiKey: 'gemini-key',
      baseUrl: 'https://generativelanguage.googleapis.com',
      inputImages: [{ data: Buffer.from([4, 5, 6]), mimeType: 'image/jpeg' }],
      model: 'gemini-3-pro-image-preview',
      prompt: 'edit this image',
      signal: new AbortController().signal,
      size: '2048x1152',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1beta/models/gemini-3-pro-image-preview:generateContent')
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'gemini-key' })
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig).toMatchObject({
      responseModalities: ['TEXT', 'IMAGE'],
      responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } },
    })
    expect(body.contents[0].parts[0].inlineData).toEqual({
      mimeType: 'image/jpeg',
      data: 'BAUG',
    })
    expect(result.images).toHaveLength(1)
    expect(result.images[0]?.bytes).toEqual(Buffer.from([1, 2, 3]))
  })

  it('retries with the legacy imageConfig shape for compatible relays', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'unknown responseFormat' } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/jpeg', data: 'AQI=' } }] } }],
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGeminiGenerateContent({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com',
      inputImages: [],
      model: 'gemini-image',
      prompt: 'generate image',
      signal: new AbortController().signal,
      size: '1024x1024',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const legacyBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))
    expect(legacyBody.generationConfig.imageConfig).toEqual({ aspectRatio: '1:1', imageSize: '1K' })
    expect(result.images[0]?.mimeType).toBe('image/jpeg')
  })
})
