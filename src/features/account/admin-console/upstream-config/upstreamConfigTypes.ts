import type { AdminUpstreamProvider, AdminUpstreamTestResult } from '../../../../types'
import type { UpstreamDraft } from '../shared'

export interface UpstreamConfigDraftProps {
  draft: UpstreamDraft
  setDraft: (updater: (prev: UpstreamDraft) => UpstreamDraft) => void
}

export interface UpstreamDiagnosticsProps {
  editingUpstreamId: string | null
  upstreams: AdminUpstreamProvider[]
  upstreamTests: Record<string, AdminUpstreamTestResult>
  testingUpstreamId: string | null
  onTest: (id: string) => void
}
