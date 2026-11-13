import { describe, expect, it } from 'vitest'
import { buildChatCompletionsEndpoint } from '../routes/chat.js'

describe('chat completions endpoint builder', () => {
  it('appends /v1/chat/completions to bare upstream base urls', () => {
    expect(buildChatCompletionsEndpoint('https://api.example.com')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
  })

  it('reuses base urls that already contain /v1', () => {
    expect(buildChatCompletionsEndpoint('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
  })

  it('keeps full chat completions urls untouched', () => {
    expect(buildChatCompletionsEndpoint('https://api.example.com/v1/chat/completions')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
    expect(buildChatCompletionsEndpoint('https://gateway.example.com/openai/v1/chat/completions')).toBe(
      'https://gateway.example.com/openai/v1/chat/completions',
    )
  })

  it('strips trailing slashes before appending', () => {
    expect(buildChatCompletionsEndpoint(' https://api.example.com// ')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
  })
})
