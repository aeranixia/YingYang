import { beforeEach, expect, it, vi } from 'vitest'
import { readTextSize, textSizeKey } from './preferences'
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
it.each(['small', 'medium', 'large'] as const)('글자 크기 %s 복구', size => {
  localStorage.setItem(textSizeKey, size)
  expect(readTextSize()).toBe(size)
})
it('미설정 및 잘못된 글자 크기는 중으로 복구', () => {
  expect(readTextSize()).toBe('medium')
  localStorage.setItem(textSizeKey, 'unexpected')
  expect(readTextSize()).toBe('medium')
})
it('저장 공간 읽기 실패 시 중으로 표시', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(readTextSize()).toBe('medium')
  vi.restoreAllMocks()
})
