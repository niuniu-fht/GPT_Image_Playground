import type { AdminUpstreamProvider, ModelConfig } from '../../../types'
import {
  cx,
  EmptyState,
  formatTime,
  SectionShell,
  StatusBadge,
  upstreamHealthLabel,
  upstreamHealthTone,
} from './shared'

type ModelsSectionProps = {
  models: ModelConfig[]
  filteredModels: ModelConfig[]
  upstreams: AdminUpstreamProvider[]
  modelQuery: string
  modelStatusFilter: string
  modelProviderFilter: string
  modelHealthFilter: string
  selectedModelIds: string[]
  modelBatchOperating: boolean
  setModelQuery: (value: string) => void
  setModelStatusFilter: (value: string) => void
  setModelProviderFilter: (value: string) => void
  setModelHealthFilter: (value: string) => void
  setSelectedModelIds: (value: string[]) => void
  toggleCurrentPageModels: (checked: boolean) => void
  toggleModelSelection: (modelId: string) => void
  batchPatchModels: (input: Partial<Pick<ModelConfig, 'enabled' | 'isNew'>>) => void
  openModelEditor: (model?: ModelConfig) => void
  patchModel: (modelId: string, input: Partial<Pick<ModelConfig, 'enabled' | 'isNew'>>, successMessage: string) => void
  deleteModelById: (modelId: string) => void
}

export function ModelsSection({
  models,
  filteredModels,
  upstreams,
  modelQuery,
  modelStatusFilter,
  modelProviderFilter,
  modelHealthFilter,
  selectedModelIds,
  modelBatchOperating,
  setModelQuery,
  setModelStatusFilter,
  setModelProviderFilter,
  setModelHealthFilter,
  setSelectedModelIds,
  toggleCurrentPageModels,
  toggleModelSelection,
  batchPatchModels,
  openModelEditor,
  patchModel,
  deleteModelById,
}: ModelsSectionProps) {
  return (
    <SectionShell
      title="模型配置"
      description="前台模型下拉的展示、价格、上游模型和渠道绑定。"
      action={
        <div className="grid w-full gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[240px_120px_180px_140px_auto]">
          <input
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder="搜索模型、渠道、上游标识"
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <select value={modelStatusFilter} onChange={(event) => setModelStatusFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <option value="all">全部状态</option>
            <option value="enabled">启用</option>
            <option value="disabled">停用</option>
          </select>
          <select value={modelProviderFilter} onChange={(event) => setModelProviderFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <option value="all">全部渠道</option>
            <option value="default">环境变量默认</option>
            {upstreams.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
          <select value={modelHealthFilter} onChange={(event) => setModelHealthFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <option value="all">全部健康状态</option>
            <option value="healthy">上游可用</option>
            <option value="error">上游异常</option>
            <option value="unknown">未测试</option>
            <option value="default">默认上游</option>
          </select>
          <button onClick={() => openModelEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">新增模型</button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <label className="inline-flex items-center gap-2 font-semibold text-gray-500">
          <input
            type="checkbox"
            checked={filteredModels.length > 0 && selectedModelIds.length === filteredModels.length}
            onChange={(event) => toggleCurrentPageModels(event.target.checked)}
            aria-label="选择当前筛选模型"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          已选 {selectedModelIds.length} / 当前筛选 {filteredModels.length}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!selectedModelIds.length || modelBatchOperating} onClick={() => batchPatchModels({ enabled: true })} className="h-8 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">批量启用</button>
          <button type="button" disabled={!selectedModelIds.length || modelBatchOperating} onClick={() => batchPatchModels({ enabled: false })} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">批量停用</button>
          <button type="button" disabled={!selectedModelIds.length || modelBatchOperating} onClick={() => batchPatchModels({ isNew: true })} className="h-8 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-400/20 dark:hover:bg-blue-400/10">批量设 New</button>
          <button type="button" disabled={!selectedModelIds.length || modelBatchOperating} onClick={() => batchPatchModels({ isNew: false })} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消 New</button>
          <button type="button" disabled={!selectedModelIds.length || modelBatchOperating} onClick={() => setSelectedModelIds([])} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消选择</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
          当前显示 <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredModels.length}</span> / {models.length} 个模型
        </div>
        <div className="border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-400 dark:border-white/[0.06] dark:bg-transparent md:hidden">
          横向滑动查看更多模型字段和操作
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1520px]">
            <div className="grid grid-cols-[34px_1.45fr_120px_150px_190px_150px_90px_90px_80px_100px_260px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <span />
              <span>展示模型</span>
              <span>标识</span>
              <span>上游渠道</span>
              <span>上游健康</span>
              <span>上游模型</span>
              <span>协议</span>
              <span>单价</span>
              <span>排序</span>
              <span>状态</span>
              <span className="sticky right-0 z-20 -mr-4 bg-gray-50 py-0.5 pr-4 text-right shadow-[-18px_0_22px_-24px_rgba(15,23,42,0.8)] dark:bg-[#111827]">操作</span>
            </div>
            {filteredModels.map((model) => {
              const checked = selectedModelIds.includes(model.id)
              return (
                <div key={model.id} className={cx('grid grid-cols-[34px_1.45fr_120px_150px_190px_150px_90px_90px_80px_100px_260px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModelSelection(model.id)}
                      aria-label={`选择模型 ${model.displayName}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-950 dark:text-gray-50">{model.displayName}</span>
                      {model.isNew && <StatusBadge tone="blue">New</StatusBadge>}
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-gray-400">{model.description}</div>
                  </div>
                  <div className="truncate text-xs font-medium text-gray-600 dark:text-gray-300">{model.name}</div>
                  <div className="truncate text-gray-700 dark:text-gray-200">{model.upstreamProvider?.name ?? '环境变量默认'}</div>
                  <div className="min-w-0 space-y-1">
                    {model.upstreamProvider ? (
                      <>
                        <StatusBadge tone={upstreamHealthTone(model.upstreamProvider.lastHealthStatus)}>{upstreamHealthLabel(model.upstreamProvider.lastHealthStatus)}</StatusBadge>
                        <div className="truncate text-xs text-gray-400">
                          {model.upstreamProvider.lastCheckedAt ? `${formatTime(model.upstreamProvider.lastCheckedAt)} · ${model.upstreamProvider.lastLatencyMs ?? '-'}ms` : '尚未检测'}
                        </div>
                        {model.upstreamProvider.lastHealthMessage && (
                          <div className="truncate text-[11px] text-gray-400" title={model.upstreamProvider.lastHealthMessage}>{model.upstreamProvider.lastHealthMessage}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <StatusBadge tone="gray">默认上游</StatusBadge>
                        <div className="text-xs text-gray-400">使用服务端环境变量</div>
                      </>
                    )}
                  </div>
                  <div className="truncate text-xs text-gray-500">{model.upstreamModel}</div>
                  <StatusBadge tone="gray">{model.apiProtocol}</StatusBadge>
                  <div className="font-semibold text-amber-700">{model.costCredits} 分</div>
                  <div className="text-gray-600 dark:text-gray-300">{model.sortOrder}</div>
                  <StatusBadge tone={model.enabled ? 'green' : 'gray'}>{model.enabled ? '启用' : '停用'}</StatusBadge>
                  <div className={cx('sticky right-0 z-10 -mr-4 flex flex-wrap justify-end gap-1.5 py-1 pr-4 shadow-[-18px_0_22px_-24px_rgba(15,23,42,0.75)]', checked ? 'bg-blue-50 dark:bg-[#172554]' : 'bg-white dark:bg-[#111827]')}>
                    <button type="button" onClick={() => openModelEditor(model)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">编辑</button>
                    <button type="button" onClick={() => patchModel(model.id, { enabled: !model.enabled }, '模型状态已更新')} className={cx('h-8 rounded-lg border px-2.5 text-xs font-medium', model.enabled ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10')}>
                      {model.enabled ? '停用' : '启用'}
                    </button>
                    <button type="button" onClick={() => patchModel(model.id, { isNew: !model.isNew }, 'New 标识已更新')} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">
                      {model.isNew ? '取消New' : '设New'}
                    </button>
                    <button type="button" onClick={() => deleteModelById(model.id)} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>
                  </div>
                </div>
              )
            })}
            {!filteredModels.length && <EmptyState text={models.length ? '暂无匹配的模型配置' : '暂无模型配置'} />}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
