/** Browser-local viewing preferences; classification data stays on the Host. */
import { defineStore } from '@deepseek-ai/dsh-client-store'

/** Only expansion is retained; legacy filter and visibility properties are ignored. */
export interface ViewState {
  expanded: Record<string, boolean>
}
/** @returns a fresh view handle, shared only by registrations in one plugin instance. */
export function createClassifierViewStore() {
  return defineStore({
    init: (): ViewState => ({ expanded: {} }),
    persist: 'dsh.better-classifier.view.v1',
    actions: {
      expand: (state, key: string, value: boolean) => { state.expanded[key] = value },
      reveal: (state, keys: readonly string[]) => { for (const key of keys) state.expanded[key] = true },
    },
  })
}
