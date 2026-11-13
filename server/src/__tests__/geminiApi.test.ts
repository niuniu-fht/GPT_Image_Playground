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
    expect(resolveGeminiImageConfig('2832x1584')).toEqual({
      aspectRatio: '16:9',
      imageSize: '2K',
    })
    // 旧版 2048x1152 的 2K 尺寸低于 300w 下限，按新档位定义归入 1K
    expect(resolveGeminiImageConfig('2048x1152')).toEqual({
      aspectRatio: '16:9',
      imageSize: '1K',
    })
    expect(resolveGeminiImageConfig('3840x3840')).toEqual({
      aspectRatio: '1:1',
      imageSize: '4K',
    })
  })

  it.each([
    ['1024x1024', '1:1'],
    ['1824x1024', '16:9'],
    ['1024x1824', '9:16'],
    ['1360x1024', '4:3'],
    ['1024x1360', '3:4'],
    ['1536x1024', '3:2'],
    ['1024x1536', '2:3'],
    ['1280x1024', '5:4'],
    ['1024x1280', '4:5'],
    ['2384x1024', '21:9'],
  ])('maps playground size %s to Gemini ratio %s', (size, ratio) => {
    expect(resolveGeminiImageConfig(size).aspectRatio).toBe(ratio)
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
      size: '2832x1584',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1beta/models/gemini-3-pro-image-preview:generateContent')
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'gemini-key' })
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig).toMatchObject({
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
    })
    expect(body.contents[0].parts[0].inlineData).toEqual({
      mimeType: 'image/jpeg',
      data: 'BAUG',
    })
    expect(result.images).toHaveLength(1)
    expect(result.images[0]?.bytes).toEqual(Buffer.from([1, 2, 3]))
  })

  it('retries with the responseFormat shape when the upstream rejects imageConfig', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'unknown imageConfig' } }), { status: 400 }))
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
    const alternateBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))
    expect(alternateBody.generationConfig.responseFormat).toEqual({
      image: { aspectRatio: '1:1', imageSize: '1K' },
    })
    expect(result.images[0]?.mimeType).toBe('image/jpeg')
  })

  it('remembers the legacy format preference and uses it first on the next request', async () => {
    const fetchMock = vi.fn()
      // 第一次请求：imageConfig 被 400 拒绝
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'unknown imageConfig' } }), { status: 400 }))
      // 重试：旧格式成功
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'AQID' } }] } }],
      }), { status: 200 }))
      // 第二次请求：应直接使用旧格式，一次成功
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'AQID' } }] } }],
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const request = {
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com',
      inputImages: [],
      prompt: 'generate image',
      signal: new AbortController().signal,
      size: '1024x1024',
    }
    await callGeminiGenerateContent({ ...request, model: 'gemini-legacy-model' })
    await callGeminiGenerateContent({ ...request, model: 'gemini-legacy-model' })

    // 第 1 次请求：imageConfig 被拒 → 旧格式重试成功（共 2 次调用）
    // 第 2 次请求：记住偏好后直接用旧格式，一次成功（第 3 次调用）
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    const retriedBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))
    const secondRequestBody = JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))
    expect(firstBody.generationConfig.imageConfig).toBeDefined()
    expect(retriedBody.generationConfig.responseFormat).toEqual({
      image: { aspectRatio: '1:1', imageSize: '1K' },
    })
    expect(secondRequestBody.generationConfig.responseFormat).toEqual({
      image: { aspectRatio: '1:1', imageSize: '1K' },
    })
    expect(secondRequestBody.generationConfig.imageConfig).toBeUndefined()
  })

  it('does not retry the alternate shape when the upstream blocks the content', async () => {
    // 内容审核 400：备用格式过不了审，且会把 imageConfig 挪出 generationConfig，
    // 导致网关按 1K 档调度、上游按默认 1:1 1K 出图 —— 必须直接报错。
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 400, message: '内容审核未通过，请修改提示词后重试', status: 'INVALID_ARGUMENT' },
      }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGeminiGenerateContent({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com',
      inputImages: [],
      model: 'gemini-image',
      prompt: 'nsfw prompt',
      signal: new AbortController().signal,
      size: '3840x2160',
    })).rejects.toMatchObject({ status: 400, code: 'gemini_upstream_error' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry the alternate shape when the upstream blocks with safety keywords', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 400, message: 'Image generation blocked due to PROHIBITED_CONTENT', status: 'INVALID_ARGUMENT' },
      }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGeminiGenerateContent({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com',
      inputImages: [],
      model: 'gemini-image',
      prompt: 'nsfw prompt',
      signal: new AbortController().signal,
      size: '3840x2160',
    })).rejects.toMatchObject({ status: 400, code: 'gemini_upstream_error' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
