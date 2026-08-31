export const API_PROTOCOL_OPTIONS = [
  { value: 'images', label: 'OpenAI 图片接口', hint: '/v1/images/generations 与 /edits' },
  { value: 'responses', label: '响应接口', hint: '适合兼容响应式图片工作流' },
  { value: 'gemini', label: 'Gemini 原生接口', hint: '/v1beta/models/{model}:generateContent' },
] as const

export const MODEL_STATUS_OPTIONS = [
  { value: true, label: '启用', tone: 'green' },
  { value: false, label: '停用', tone: 'gray' },
] as const

export function modelProtocolLabel(value: string): string {
  return API_PROTOCOL_OPTIONS.find((item) => item.value === value)?.label ?? value
}
