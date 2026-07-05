import { createPromptLibraryItem, normalizePromptLibraryItems } from "../domain"
import { evictImage } from "../imageAssets"
import { DEFAULT_PARAMS } from "../taskParams"
import type { AppState } from "../contracts"
import type { StoreSet } from "./sliceTypes"
import type { InputImage, PromptLibraryItem, TaskParams } from "../../types"

type InputDraftSliceState = Pick<
  AppState,
  | 'prompt'
  | 'setPrompt'
  | 'promptLibrary'
  | 'replacePromptLibrary'
  | 'savePromptLibraryItem'
  | 'removePromptLibraryItem'
  | 'inputImages'
  | 'addInputImage'
  | 'removeInputImage'
  | 'clearInputImages'
  | 'setInputImages'
  | 'params'
  | 'setParams'
>

export function createInputDraftSlice(set: StoreSet): InputDraftSliceState {
  return {
    prompt: "",
    setPrompt(prompt: string) { set({ prompt }) },

    promptLibrary: [] as PromptLibraryItem[],
    replacePromptLibrary(promptLibrary: PromptLibraryItem[]) {
      set(() => ({ promptLibrary: normalizePromptLibraryItems(promptLibrary) }))
    },
    savePromptLibraryItem(input: { title?: string; content: string }) {
      const nextItem = createPromptLibraryItem(input.content, input.title)
      set((state) => ({
        promptLibrary: [nextItem, ...state.promptLibrary.filter((item) => item.id !== nextItem.id)],
      }))
      return nextItem
    },
    removePromptLibraryItem(id: string) {
      set((state) => ({ promptLibrary: state.promptLibrary.filter((item) => item.id !== id) }))
    },

    inputImages: [] as InputImage[],
    addInputImage(image: InputImage) {
      set((state) => {
        if (state.inputImages.find((item) => item.id === image.id)) return state
        return { inputImages: [...state.inputImages, image] }
      })
    },
    removeInputImage(index: number) {
      set((state) => ({ inputImages: state.inputImages.filter((_, i) => i !== index) }))
    },
    clearInputImages() {
      set((state) => {
        for (const image of state.inputImages) evictImage(image.id)
        return { inputImages: [] }
      })
    },
    setInputImages(inputImages: InputImage[]) { set({ inputImages }) },

    params: { ...DEFAULT_PARAMS },
    setParams(params: Partial<TaskParams>) {
      set((state) => ({ params: { ...state.params, ...params } }))
    },
  }
}
