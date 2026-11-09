import { expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

it('formats mobile display while retaining canonical digits for either input style', () => {
 for (const value of ['01000001234', '010-0000-1234']) {
  expect(formatPhone(value)).toBe('010-0000-1234')
  expect(normalizePhone(value)).toBe('01000001234')
 }
})
it('preserves digits for ten-digit input and never fills missing digits or removes invalid letters', () => {
 expect(formatPhone('010-0000-000')).toBe('010-000-0000')
 expect(normalizePhone(formatPhone('010-0000-000'))).toBe('0100000000')
 expect(formatPhone('0212345678')).toBe('02-1234-5678')
 for (const value of ['01012','010abcd1234']) expect(formatPhone(value)).toBe(value)
})
