export const STAGING_PROJECT = 'yingyangtest'
export function allowedStage(projectId: string | undefined, tester: unknown): boolean {
 return projectId === STAGING_PROJECT && tester === true
}
export function isEmptyStatusInput(data: unknown): boolean {
 return data !== null && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0
}
export function createLocalLimiter(limit = 5) {
 let windowStart = 0, count = 0
 return (now: number) => {
  if (now - windowStart >= 60_000) { windowStart = now; count = 0 }
  if (count >= limit) return false
  count += 1
  return true
 }
}
