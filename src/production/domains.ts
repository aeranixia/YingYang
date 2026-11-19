export const productionHosts = ['yingyangcheck.web.app', 'yingyangcheck.firebaseapp.com', 'koreanmbti.com', 'www.koreanmbti.com'] as const
export const productionOrigins = productionHosts.map(host => `https://${host}`)
export function isProductionHost(host: string) { return productionHosts.some(allowed => allowed === host) }
