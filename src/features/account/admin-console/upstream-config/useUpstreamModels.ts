import { useEffect, useMemo, useState } from 'react'
import { platformApi, type AdminUpstreamModelOption } from '../../../../lib/platformApi'

export function useUpstreamModels(providerId: string | null | undefined) {
  const [models, setModels] = useState<AdminUpstreamModelOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  useEffect(() => {
    setModels([])
    setError('')
    setCheckedAt(null)
    setLatencyMs(null)
  }, [providerId])

  async function loadModels() {
    if (!providerId) {
      setError('请先选择一个上游渠道')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await platformApi.listAdminUpstreamModels(providerId)
      setModels(result.models)
      setCheckedAt(result.checkedAt)
      setLatencyMs(result.latencyMs)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '模型列表拉取失败')
    } finally {
      setLoading(false)
    }
  }

  const modelIds = useMemo(() => models.map((model) => model.id), [models])

  return {
    models,
    modelIds,
    loading,
    error,
    checkedAt,
    latencyMs,
    loadModels,
  }
}
