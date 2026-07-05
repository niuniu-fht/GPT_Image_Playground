export const API_PROTOCOL_OPTIONS = [
  { value: 'images', label: '图片接口', hint: '适合标准图片生成与编辑' },
  { value: 'responses', label: '响应接口', hint: '适合兼容响应式图片工作流' },
] as const

export const MODEL_STATUS_OPTIONS = [
  { value: true, label: '启用', tone: 'green' },
  { value: false, label: '停用', tone: 'gray' },
] as const

export function modelProtocolLabel(value: string): string {
  return API_PROTOCOL_OPTIONS.find((item) => item.value === value)?.label ?? value
}
