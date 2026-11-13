// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitTagCount, TagLayoutOwner } from '../src/client/tag-layout.ts'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })

describe('available tag space', () => {
  it('shows all tags when they fit, otherwise reserves the indicator before fitting a prefix', () => {
    expect(fitTagCount(98, [30, 30, 30], [16], 4)).toBe(3)
    expect(fitTagCount(97.9, [30, 30, 30], [16], 4)).toBe(2)
    expect(fitTagCount(84, [30, 30, 30], [16], 4)).toBe(2)
    expect(fitTagCount(83.9, [30, 30, 30], [16], 4)).toBe(1)
    expect(fitTagCount(49.9, [30, 30, 30], [16], 4)).toBe(0)
    expect(fitTagCount(0, [], [], 4)).toBe(0)
    expect(fitTagCount(15, [15], [16], 4)).toBe(1)
  })

  it('accounts for the +10 to +9 width transition and preserves assignment order', () => {
    expect(fitTagCount(32, Array<number>(11).fill(4), [16, 24], 4)).toBe(2)
    expect(fitTagCount(60, [88, 12, 12], [16], 4)).toBe(0)
    expect(fitTagCount(110, [88, 12, 12], [16], 4)).toBe(1)
  })

  it('measures resize and font changes, transfers hidden focus and releases every observer on unload', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++frameId, fn); return frameId })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
    const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0)) }
    const watched = new Set<Element>()
    let resized = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback }
      observe(element: Element) { watched.add(element) }
      unobserve(element: Element) { watched.delete(element) }
      disconnect() { watched.clear() }
    })
    const fonts = new EventTarget()
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
    const owner = new TagLayoutOwner()
    const element = document.createElement('span')
    element.style.columnGap = '4px'
    element.innerHTML = '<span data-tag-measure></span><span data-tag-measure></span><span data-tag-measure></span><span data-tag-counter></span><button data-tag-index="2">third</button><button data-tag-overflow>+2</button>'
    document.body.append(element)
    let width = 120, tagWidth = 30
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 19))
    for (const child of element.querySelectorAll('[data-tag-measure]')) {
      vi.spyOn(child, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, tagWidth, 19))
    }
    vi.spyOn(element.querySelector('[data-tag-counter]')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 16, 19))
    owner.attach('row', element)
    expect(watched.size).toBe(5)
    flush()
    expect(owner.values.getSnapshot().row).toEqual({ count: 3, minimum: 16 })
    element.querySelector<HTMLButtonElement>('[data-tag-index]')!.focus()
    width = 70
    resized(); flush()
    expect(owner.values.getSnapshot().row?.count).toBe(1)
    element.querySelector('[data-tag-index]')!.remove()
    flush()
    expect(document.activeElement).toBe(element.querySelector('[data-tag-overflow]'))
    width = 120
    resized(); flush()
    expect(owner.values.getSnapshot().row?.count).toBe(3)
    element.querySelector('[data-tag-overflow]')!.remove()
    const revealed = document.createElement('button')
    revealed.dataset.tagIndex = '1'
    element.append(revealed)
    flush()
    expect(document.activeElement).toBe(revealed)
    tagWidth = 70
    fonts.dispatchEvent(new Event('loadingdone')); flush()
    expect(owner.values.getSnapshot().row?.count).toBe(1)
    owner.attach('row', null)
    expect(watched.size).toBe(0)
    expect(owner.values.getSnapshot()).toEqual({})
    owner.attach('row', element)
    owner.dispose()
    expect(watched.size).toBe(0)
    expect(frames.size).toBe(0)
    fonts.dispatchEvent(new Event('loadingdone'))
    expect(frames.size).toBe(0)
    Reflect.deleteProperty(document, 'fonts')
  })
})
