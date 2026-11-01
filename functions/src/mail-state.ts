import { GoogleAuth } from 'google-auth-library'

export type Stored<T> = { value: T; generation: string }
export interface StateStore {
 read<T>(name: string): Promise<Stored<T> | null>
 write<T>(name: string, value: T, generation: string): Promise<string>
}
export class Conflict extends Error {}
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
export async function runtimeToken(): Promise<string> {
 const token = await auth.getAccessToken()
 if (!token) throw new Error('Runtime credentials unavailable')
 return token
}
export class GcsStateStore implements StateStore {
 constructor(private readonly bucket: string, private readonly token = runtimeToken) {
  if (!['yingyangtest-mail-state-495270334718','yingyangcheck-mail-state-231582543863'].includes(bucket)) throw new Error('Invalid mail state bucket')
 }
 async read<T>(name: string): Promise<Stored<T> | null> {
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(name)}?alt=media`, { headers: { authorization: `Bearer ${await this.token()}` }, signal: AbortSignal.timeout(5000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('State read unavailable')
  const generation = response.headers.get('x-goog-generation')
  if (!generation) throw new Error('State version unavailable')
  return { value: await response.json() as T, generation }
 }
 async write<T>(name: string, value: T, generation: string): Promise<string> {
  const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(name)}&ifGenerationMatch=${encodeURIComponent(generation)}`, { method: 'POST', headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' }, body: JSON.stringify(value), signal: AbortSignal.timeout(5000) })
  if (response.status === 412) throw new Conflict('Concurrent state update')
  if (!response.ok) throw new Error('State write unavailable')
  const metadata = await response.json() as { generation?: string }
  if (!metadata.generation) throw new Error('State version unavailable')
  return metadata.generation
 }
}
