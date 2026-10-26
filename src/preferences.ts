export type TextSize = 'small' | 'medium' | 'large'
export const textSizeKey = 'yingyang:text-size'
export const textSizes: { value: TextSize; label: string }[] = [
  { value: 'small', label: '소' },
  { value: 'medium', label: '중' },
  { value: 'large', label: '대' },
]
export function readTextSize(): TextSize {
  try {
    const value = localStorage.getItem(textSizeKey)
    return textSizes.some(size => size.value === value) ? value as TextSize : 'medium'
  } catch {
    return 'medium'
  }
}
