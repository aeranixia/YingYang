export const consentVersion = 'staging-bc-draft-1'
export const syntheticNames = ['가상테스터', '테스트환자'] as const
export const syntheticPhones = ['01000001234', '01000005678'] as const
export type MockScenario = 'success' | 'fail-once'
export type Submission = {
 requestId: string
 version: number
 name: string
 phone: string
 acquired: number[]
 innate: number[]
 consent: { personal: boolean; sensitive: boolean; synthetic: boolean; version: string }
 scenario: MockScenario
}
export type MockReceipt = { status: 'mock-completed'; requestId: string; duplicate: boolean }
