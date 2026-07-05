import { useEffect, useRef, type KeyboardEventHandler } from 'react'
import { submitTask } from '../../../../store'
import type { PromptSectionViewModel } from './useInputBarState'

interface UsePromptInputControllerOptions {
  prompt: string
  normalizedPrompt: string
  promptHintText: string
  isMobile: boolean
  mobileDrawerOpen: boolean
  onPromptChange: (value: string) => void
}

export function usePromptInputController(
  options: UsePromptInputControllerOptions,
): PromptSectionViewModel {
  const {
    prompt,
    normalizedPrompt,
    promptHintText,
    isMobile,
    mobileDrawerOpen,
    onPromptChange,
  } = options
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePromptKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      submitTask()
    }
  }

  useEffect(() => {
    if (!mobileDrawerOpen) return

    const frameId = window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [mobileDrawerOpen])

  return {
    prompt,
    normalizedPrompt,
    promptHintText,
    isMobile,
    textareaRef,
    onPromptChange,
    onKeyDown: handlePromptKeyDown,
  }
}
