import {
  type ClipboardEventHandler,
  useCallback,
  useState,
  type ChangeEventHandler,
  type DragEventHandler,
  type KeyboardEventHandler,
  type RefObject,
} from 'react'
import { openLightbox, resolveTaskParamSizeOrDefault, useStore, submitTask } from '../../../../store'
import { resolveModelCostForSize } from '../../../../lib/modelCost'
import {
  ALL_CATEGORY_FILTER,
  FAVORITES_CATEGORY_FILTER,
  type ModelConfig,
  resolveCategoryFilterName,
  type InputImage,
  type TaskParams,
} from '../../../../types'
import { API_MAX_IMAGES } from './shared'
import { useInputImageControls } from './useInputImageControls'
import { usePromptInputController } from './usePromptInputController'
import { useIsMobile } from './useIsMobile'

export interface PromptSectionViewModel {
  prompt: string
  normalizedPrompt: string
  promptHintText: string
  isMobile: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onPromptChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
}

export interface ReferenceImagesSectionViewModel {
  isMobile: boolean
  inputImages: InputImage[]
  maskedInputCount: number
  primaryMaskedInput: InputImage | null
  atImageLimit: boolean
  showImageUrlInput: boolean
  imageUrlInput: string
  imageUrlInputRef: RefObject<HTMLInputElement | null>
  imageUrlPopoverRef: RefObject<HTMLDivElement | null>
  onToggleImageUrlInput: () => void
  onImageUrlInputChange: (value: string) => void
  onCancelImageUrlInput: () => void
  onSubmitImageUrl: () => void
  onOpenFilePicker: () => void
  onPreviewImage: (imageId: string) => void
  onRemoveInputImage: (index: number) => void
  onRequestClearAllImages: () => void
  onReopenMaskedEdit: () => void
  onClearMaskedEdit: () => void
}

export interface ParamsSectionViewModel {
  activeModelId: string | null
  estimatedCost: number
  models: ModelConfig[]
  normalizedSize: string
  params: TaskParams
  onActiveModelChange: (modelId: string) => void
  onSetParams: (params: Partial<TaskParams>) => void
}

export interface SubmitSectionViewModel {
  generationTargetLabel: string
  isLoggedIn: boolean
  activeModel: ModelConfig | null
  creditBalance: number
  estimatedCost: number
  canSubmit: boolean
  isMobile: boolean
  onSubmit: () => void
  onOpenSettings: () => void
}

export interface InputPanelBindings {
  onPaste: ClipboardEventHandler<HTMLDivElement>
  onDragEnter: DragEventHandler<HTMLDivElement>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDragLeave: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
}

export interface InputBarContentViewModel {
  isMobile: boolean
  panelBindings: InputPanelBindings
  promptSectionProps: PromptSectionViewModel
  referenceImagesSectionProps: ReferenceImagesSectionViewModel
  paramsSectionProps: ParamsSectionViewModel
  submitSectionProps: SubmitSectionViewModel
}

export interface InputBarViewModel {
  isMobile: boolean
  normalizedPrompt: string
  promptPreview: string
  isDragging: boolean
  atImageLimit: boolean
  mobileDrawerOpen: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  inputContent: InputBarContentViewModel
  onOpenMobileDrawer: () => void
  onCloseMobileDrawer: () => void
  onFileUpload: ChangeEventHandler<HTMLInputElement>
}

export function useInputBarState(): InputBarViewModel {
  // ===== Store selectors =====
  const prompt = useStore((state) => state.prompt)
  const setPrompt = useStore((state) => state.setPrompt)
  const inputImages = useStore((state) => state.inputImages)
  const removeInputImage = useStore((state) => state.removeInputImage)
  const clearInputImages = useStore((state) => state.clearInputImages)
  const categories = useStore((state) => state.categories)
  const activeCategoryFilter = useStore((state) => state.activeCategoryFilter)
  const currentUser = useStore((state) => state.currentUser)
  const models = useStore((state) => state.models)
  const activeModelId = useStore((state) => state.activeModelId)
  const setActiveModelId = useStore((state) => state.setActiveModelId)
  const params = useStore((state) => state.params)
  const setParams = useStore((state) => state.setParams)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)

  // ===== Local state =====
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // ===== Derived values =====
  const isMobile = useIsMobile()
  const activeModel = models.find((model) => model.id === activeModelId) ?? models[0] ?? null
  const generationTargetLabel =
    activeCategoryFilter === ALL_CATEGORY_FILTER || activeCategoryFilter === FAVORITES_CATEGORY_FILTER
      ? '未分类'
      : resolveCategoryFilterName(activeCategoryFilter, categories)
  const promptHintText = isMobile
    ? '先写主体需求，下面选择比例和图片数量'
    : '桌面端支持 Ctrl+Enter 直接生成'
  const estimatedCost = resolveModelCostForSize(activeModel, params.size) * Math.max(1, Math.floor(params.n))
  const creditBalance = currentUser?.creditBalance ?? 0
  const canSubmit =
    Boolean(prompt.trim() || inputImages.length) &&
    Boolean(currentUser) &&
    Boolean(activeModel) &&
    creditBalance >= estimatedCost
  const atImageLimit = inputImages.length >= API_MAX_IMAGES
  const maskedInputCount = inputImages.filter((image) => Boolean(image.maskDataUrl)).length
  const primaryMaskedInputIndex = inputImages.findIndex((image) => Boolean(image.maskDataUrl))
  const primaryMaskedInput =
    primaryMaskedInputIndex >= 0 ? inputImages[primaryMaskedInputIndex] : null
  const normalizedPrompt = prompt.trim()
  const promptPreview =
    normalizedPrompt.replace(/\s+/g, ' ').slice(0, 120) || '输入框已收起，点击展开继续编辑'
  const normalizedSize = resolveTaskParamSizeOrDefault(params.size)
  // ===== Callbacks =====
  const requestClearInputImages = useCallback(() => {
    setConfirmDialog({
      title: '清空参考图',
      message: `确定要清空全部 ${inputImages.length} 张参考图吗？`,
      action: () => clearInputImages(),
    })
  }, [clearInputImages, inputImages.length, setConfirmDialog])

  const handleSubmit = useCallback(() => {
    submitTask()
    setMobileDrawerOpen(false)
  }, [])

  // ===== Sub-ViewModel: PromptSection =====
  const promptSectionProps = usePromptInputController({
    prompt,
    normalizedPrompt,
    promptHintText,
    isMobile,
    mobileDrawerOpen,
    onPromptChange: setPrompt,
  })

  // ===== Sub-ViewModel: ReferenceImagesSection =====
  const { fileInputRef, isDragging, onFileUpload, panelBindings, referenceImagesSectionProps } =
    useInputImageControls({
      isMobile,
      inputImages,
      maskedInputCount,
      primaryMaskedInput,
      primaryMaskedInputIndex,
    atImageLimit,
    mobileDrawerOpen,
    onPreviewImage: (imageId) => openLightbox(imageId, inputImages.map((image) => image.id)),
    onRemoveInputImage: removeInputImage,
    onRequestClearAllImages: requestClearInputImages,
  })

  // ===== Sub-ViewModel: ParamsSection =====
  const paramsSectionProps: ParamsSectionViewModel = {
    activeModelId,
    estimatedCost,
    models,
    normalizedSize,
    params,
    onActiveModelChange: setActiveModelId,
    onSetParams: setParams,
  }

  // ===== Sub-ViewModel: SubmitSection =====
  const submitSectionProps: SubmitSectionViewModel = {
    generationTargetLabel,
    isLoggedIn: Boolean(currentUser),
    activeModel,
    creditBalance,
    estimatedCost,
    canSubmit: Boolean(canSubmit),
    isMobile,
    onSubmit: handleSubmit,
    onOpenSettings: () => openAuthModal('login'),
  }

  // ===== Assemble InputBarViewModel =====
  return {
    isMobile,
    normalizedPrompt,
    promptPreview,
    isDragging,
    atImageLimit,
    mobileDrawerOpen,
    fileInputRef,
    inputContent: {
      isMobile,
      panelBindings,
      promptSectionProps,
      referenceImagesSectionProps,
      paramsSectionProps,
      submitSectionProps,
    },
    onOpenMobileDrawer: () => setMobileDrawerOpen(true),
    onCloseMobileDrawer: () => setMobileDrawerOpen(false),
    onFileUpload,
  }
}
