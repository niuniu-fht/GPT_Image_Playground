import type { AdminUpstreamProvider } from '../../../../types'
import type { ModelDraft } from '../shared'

export interface ModelConfigDraftProps {
  draft: ModelDraft
  setDraft: (updater: (prev: ModelDraft) => ModelDraft) => void
}

export interface ModelConfigSectionProps extends ModelConfigDraftProps {
  upstreams: AdminUpstreamProvider[]
  editingModelId: string | null
}
