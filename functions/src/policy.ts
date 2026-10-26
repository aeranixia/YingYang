export const STAGING_PROJECT = 'yingyangtest'
export function allowedStage(projectId: string | undefined, tester: unknown): boolean {
 return projectId === STAGING_PROJECT && tester === true
}
export function createLocalLimiter() {
 let windowStart = 0, count = 0
 return (now: number) => {
  if (now - windowStart >= 60_000) { windowStart = now; count = 0 }
  if (count >= 5) return false
  count += 1
  return true
 }
}
