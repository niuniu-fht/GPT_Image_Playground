import { useEffect, useState, type FormEvent } from 'react'
import type { AdminSquareConfig, AdminSquareR2TestResult } from '../../../../types'
import { cx, StatusBadge } from '../shared'

type SquareConfigDraft = AdminSquareConfig & {
  squareAdminToken: string
  r2SecretKey: string
}

interface SquareStorageConfigPanelProps {
  config: AdminSquareConfig | null
  saving: boolean
  testing: boolean
  testResult: AdminSquareR2TestResult | null
  onSave: (input: Partial<SquareConfigDraft>) => void
  onTestR2: () => void
}

function createDraft(config: AdminSquareConfig | null): SquareConfigDraft {
  return {
    squareApiUrl: config?.squareApiUrl ?? '',
    squareAdminTokenConfigured: config?.squareAdminTokenConfigured ?? false,
    squareAdminToken: '',
    r2Enabled: config?.r2Enabled ?? true,
    r2Endpoint: config?.r2Endpoint ?? '',
    r2AccessKey: config?.r2AccessKey ?? '',
    r2SecretKeyConfigured: config?.r2SecretKeyConfigured ?? false,
    r2SecretKey: '',
    r2Bucket: config?.r2Bucket ?? '',
    publicBaseUrl: config?.publicBaseUrl ?? '',
    autoUploadGeneratedImages: config?.autoUploadGeneratedImages ?? false,
  }
}

export function SquareStorageConfigPanel({
  config,
  saving,
  testing,
  testResult,
  onSave,
  onTestR2,
}: SquareStorageConfigPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SquareConfigDraft>(() => createDraft(config))

  useEffect(() => {
    if (!editing) setDraft(createDraft(config))
  }, [config, editing])

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      squareApiUrl: draft.squareApiUrl,
      squareAdminToken: draft.squareAdminToken,
      r2Enabled: draft.r2Enabled,
      r2Endpoint: draft.r2Endpoint,
      r2AccessKey: draft.r2AccessKey,
      r2SecretKey: draft.r2SecretKey,
      r2Bucket: draft.r2Bucket,
      publicBaseUrl: draft.publicBaseUrl,
      autoUploadGeneratedImages: draft.autoUploadGeneratedImages,
    })
    setEditing(false)
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70 text-sm shadow-sm dark:border-sky-400/15 dark:bg-sky-400/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-100/70 px-4 py-3 dark:border-sky-400/15">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-950 dark:text-gray-50">广场存储配置</div>
            <StatusBadge tone={config?.r2Enabled === false ? 'gray' : 'green'}>
              {config?.r2Enabled === false ? '未启用' : 'Cloudflare R2'}
            </StatusBadge>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            当前广场 API 已融合进 Node 后端；图片写入 Cloudflare R2，公开资源域名只负责展示图片。Worker 地址仅作为未来外置部署选项。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTestR2}
            disabled={testing || !config}
            className="h-9 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400/20 dark:bg-gray-950 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
          >
            {testing ? '测试中...' : '测试 R2'}
          </button>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="h-9 rounded-xl border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-400/20 dark:bg-gray-950 dark:text-sky-200 dark:hover:bg-sky-400/10"
          >
            {editing ? '收起配置' : '编辑配置'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-4">
        <InfoCell label="广场 API" value={config?.squareApiUrl || '内置 Node 后端'} />
        <InfoCell label="R2 Bucket" value={config?.r2Bucket || '未配置'} />
        <InfoCell label="公开资源域名" value={config?.publicBaseUrl || '未配置'} />
        <InfoCell label="密钥状态" value={`${config?.squareAdminTokenConfigured ? 'Admin Token 已配置' : 'Admin Token 未配置'} / ${config?.r2SecretKeyConfigured ? 'R2 Secret 已配置' : 'R2 Secret 未配置'}`} />
      </div>

      {testResult && (
        <div className="mx-4 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
          <div className="font-semibold">{testResult.message}</div>
          <div className="mt-1 break-all font-mono">
            {testResult.bucket} / {testResult.objectKey} · {testResult.latencyMs}ms
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={submit} className="space-y-4 border-t border-sky-100/70 bg-white/80 p-4 dark:border-sky-400/15 dark:bg-gray-950/60">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="外置 Worker API（可选）" value={draft.squareApiUrl} onChange={(value) => setDraft((prev) => ({ ...prev, squareApiUrl: value }))} placeholder="留空则使用内置 Node 广场 API" />
            <TextField label="公开资源域名" value={draft.publicBaseUrl} onChange={(value) => setDraft((prev) => ({ ...prev, publicBaseUrl: value }))} placeholder="https://assets.code2alita.com" />
            <TextField label="R2 Endpoint" value={draft.r2Endpoint} onChange={(value) => setDraft((prev) => ({ ...prev, r2Endpoint: value }))} placeholder="https://<account>.r2.cloudflarestorage.com" />
            <TextField label="R2 Bucket" value={draft.r2Bucket} onChange={(value) => setDraft((prev) => ({ ...prev, r2Bucket: value }))} placeholder="max-canvas" />
            <TextField label="R2 Access Key" value={draft.r2AccessKey} onChange={(value) => setDraft((prev) => ({ ...prev, r2AccessKey: value }))} placeholder="留空表示不修改" />
            <TextField label="R2 Secret Key（留空不修改）" value={draft.r2SecretKey} onChange={(value) => setDraft((prev) => ({ ...prev, r2SecretKey: value }))} type="password" placeholder={draft.r2SecretKeyConfigured ? '已配置，留空不修改' : '请输入 R2 Secret Key'} />
            <TextField label="外置 Worker Admin Token（可选）" value={draft.squareAdminToken} onChange={(value) => setDraft((prev) => ({ ...prev, squareAdminToken: value }))} type="password" placeholder={draft.squareAdminTokenConfigured ? '已配置，留空不修改' : '内置广场无需填写'} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleField label="启用 R2 存储" checked={draft.r2Enabled} onChange={(value) => setDraft((prev) => ({ ...prev, r2Enabled: value }))} />
            <ToggleField label="生成完成后自动上传 R2（默认关闭，发布广场时仍会上传）" checked={draft.autoUploadGeneratedImages} onChange={(value) => setDraft((prev) => ({ ...prev, autoUploadGeneratedImages: value }))} />
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.08]">
            <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">
              取消
            </button>
            <button disabled={saving} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/80 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-gray-950">
      <div className="text-xs font-semibold text-sky-700 dark:text-sky-200">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-gray-700 dark:text-gray-200" title={value}>{value}</div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block text-xs font-semibold text-gray-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-sky-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
      />
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={cx('flex items-center justify-between rounded-xl border px-3 py-2 text-sm', checked ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-gray-200 bg-white text-gray-600 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300')}>
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
