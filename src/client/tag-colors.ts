/** Shared sidebar and preview colors; stored custom colors are never rewritten. */
function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/**
 * Prefer white ink on medium and dark fills, with a minimum 4.5 contrast ratio.
 * @param color - validated opaque #RRGGBB color from the tag definition.
 * @returns display-only fill and ink; a borderline white-ink fill is slightly darkened.
 */
export function tagColors(color: string): { backgroundColor: string; color: string } {
  const rgb = [1, 3, 5].map(index => linear(parseInt(color.slice(index, index + 2), 16) / 255))
  const luminance = rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
  if (luminance > 0.20) return { backgroundColor: color, color: '#000000' }
  const maximum = 1.05 / 4.5 - 0.05
  if (luminance <= maximum) return { backgroundColor: color, color: '#FFFFFF' }
  const backgroundColor = '#' + rgb.map(value => {
    const adjusted = value * maximum / luminance
    const srgb = adjusted <= 0.0031308 ? adjusted * 12.92 : 1.055 * adjusted ** (1 / 2.4) - 0.055
    // Round downward so integer color quantization cannot reduce the target contrast.
    return Math.floor(srgb * 255).toString(16).padStart(2, '0')
  }).join('').toUpperCase()
  return { backgroundColor, color: '#FFFFFF' }
}
