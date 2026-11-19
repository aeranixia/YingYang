import { expect, it } from 'vitest'
import { isProductionHost, productionOrigins } from './domains'

it('permits the custom domain and existing production addresses without widening trust', () => {
 for (const host of ['koreanmbti.com', 'www.koreanmbti.com', 'yingyangcheck.web.app', 'yingyangcheck.firebaseapp.com']) {
  expect(isProductionHost(host)).toBe(true)
  expect(productionOrigins).toContain(`https://${host}`)
 }
 for (const host of ['yingyangtest.web.app', 'koreanmbti.com.example.org', 'other.koreanmbti.com', 'localhost', '127.0.0.1']) expect(isProductionHost(host)).toBe(false)
 expect(productionOrigins.every(origin => origin.startsWith('https://'))).toBe(true)
})
