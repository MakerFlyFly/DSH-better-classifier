/** Pixel measurements for the prefix of direct tags that fits a native row's remaining space. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Declarative layout consumed through the renderer's injected observable hook. */
export interface TagLayout { count: number; minimum: number }

/**
 * Fit an ordered prefix, reserving the actual overflow indicator whenever tags remain hidden.
 * @param available - space supplied by the row, excluding neighboring labels, actions and gaps.
 * @param widths - capped tag border-box widths in assignment order.
 * @param counters - indicator widths indexed by the number of decimal digits minus one.
 * @param gap - spacing between tags and before the overflow indicator.
 * @returns how many leading tags can be shown without truncating a neighboring cell.
 */
export function fitTagCount(available: number, widths: readonly number[], counters: readonly number[], gap: number): number {
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
  if (total <= available) return widths.length
  let prefix = 0, count = 0
  for (let index = 0; index < widths.length - 1; index++) {
    prefix += widths[index]! + (index > 0 ? gap : 0)
    const counter = counters[String(widths.length - index - 1).length - 1]!
    if (prefix + gap + counter <= available) count = index + 1
  }
  return count
}

/** One plugin-owned observer; React components only register their committed measurement elements. */
export class TagLayoutOwner {
  readonly values = createSnapshotStore<Record<string, TagLayout>>({})
  private readonly elements = new Map<string, HTMLElement>()
  private readonly observer = new ResizeObserver(() => { this.schedule() })
  private frame: number | undefined
  private disposed = false
  private readonly focus = new Map<HTMLElement, { previous: Element; index: number | null }>()
  private readonly fontsChanged = (): void => { this.schedule() }

  constructor() {
    document.fonts?.addEventListener('loadingdone', this.fontsChanged)
  }

  /** Register a committed badge group, or release it when its ref detaches. */
  readonly attach = (key: string, element: HTMLElement | null): void => {
    const previous = this.elements.get(key)
    if (previous) {
      this.observer.unobserve(previous)
      previous.querySelectorAll('[data-tag-measure], [data-tag-counter]').forEach(item => { this.observer.unobserve(item) })
      this.focus.delete(previous)
      this.elements.delete(key)
    }
    if (element === null || this.disposed) {
      this.values.update(state => { delete state[key] })
      return
    }
    this.elements.set(key, element)
    this.observer.observe(element)
    element.querySelectorAll('[data-tag-measure], [data-tag-counter]').forEach(item => { this.observer.observe(item) })
    this.schedule()
  }

  private schedule(): void {
    if (this.frame !== undefined || this.disposed) return
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined
      for (const [element, { previous, index }] of this.focus) {
        const active = element.ownerDocument.activeElement
        if (element.isConnected && (active === previous || active === element.ownerDocument.body)) {
          element.querySelector<HTMLButtonElement>(index === null ? '[data-tag-overflow]' : `[data-tag-index="${index}"]`)?.focus({ preventScroll: true })
        }
      }
      this.focus.clear()
      for (const [key, element] of this.elements) this.measure(key, element)
      if (this.focus.size) this.schedule()
    })
  }

  private measure(key: string, element: HTMLElement): void {
    const widths = [...element.querySelectorAll('[data-tag-measure]')].map(item => item.getBoundingClientRect().width)
    const counters = [...element.querySelectorAll('[data-tag-counter]')].map(item => item.getBoundingClientRect().width)
    if (!widths.length || !counters.length) return
    const gap = parseFloat(getComputedStyle(element).columnGap)
    const width = element.getBoundingClientRect().width
    const total = widths.reduce((sum, value) => sum + value, 0) + (widths.length - 1) * gap
    const next = { count: fitTagCount(width, widths, counters, gap), minimum: Math.min(total, counters.at(-1)!) }
    const previous = this.values.getSnapshot()[key]
    if (previous?.count === next.count && previous.minimum === next.minimum) return
    const active = element.ownerDocument.activeElement
    const button = active?.closest<HTMLElement>('[data-tag-index]')
    if (button && element.contains(button) && Number(button.dataset.tagIndex) >= next.count) this.focus.set(element, { previous: button, index: null })
    if (active?.matches('[data-tag-overflow]') && element.contains(active) && next.count === widths.length) {
      this.focus.set(element, { previous: active, index: Math.min(previous?.count ?? 0, widths.length - 1) })
    }
    this.values.update(state => { state[key] = next })
  }

  /** Release observers, font listeners and scheduled frames when Cordis unloads the plugin. */
  dispose(): void {
    this.disposed = true
    this.observer.disconnect()
    document.fonts?.removeEventListener('loadingdone', this.fontsChanged)
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.elements.clear()
    this.focus.clear()
    this.values.set({})
  }
}
