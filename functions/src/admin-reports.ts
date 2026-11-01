import { createHmac, randomUUID } from 'node:crypto'
import { runtimeToken } from './mail-state'
import type { Submission } from '../../src/staging/contracts'
import type { AdminPage, AdminQuery, AdminReport } from '../../src/staging/admin-contracts'
import { reportName, validReportName } from './report-name'

export const archiveDays = 7 * 86400000
export const adminBucket = 'yingyangtest-admin-reports-495270334718'
export type ArchiveValue = { bytes: Buffer; generation: string; filename?:string }
export interface ArchiveStore {
 read(name: string): Promise<ArchiveValue | null>
 write(name: string, bytes: Buffer, contentType: string, generation: string, filename?:string): Promise<void>
 remove(name: string): Promise<void>
 list(prefix: string, cursor?: string): Promise<{ names: string[]; nextCursor?: string }>
}
export class ArchiveConflict extends Error {}
export class AdminError extends Error { constructor(public readonly code: 'permission-denied' | 'invalid-argument' | 'not-found' | 'failed-precondition' | 'unavailable') { super(code) } }
export type AdminContext = { project?: string; uid?: string; app?: boolean; role?: 'admin'|'master' }
export function requireAdmin(context: AdminContext, project='yingyangtest') {
 if (!['yingyangtest','yingyangcheck'].includes(project)) throw new AdminError('permission-denied')
 if (context.project !== project || !context.uid || !context.app || !['admin','master'].includes(context.role||'')) throw new AdminError('permission-denied')
}
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const errors = new Set(['', 'mock-failed', 'before-send-failed', 'outcome-unknown'])
export function maskedName(name: string) {
 const letters = Array.from(name.normalize('NFC'))
 return letters.length < 2 ? '*' : letters.length === 2 ? letters[0] + '*' : letters[0] + '*'.repeat(letters.length - 2) + letters[letters.length - 1]
}
export function mockOperation(uid: string, requestId: string, key: string) {
 const hex = createHmac('sha256', key).update('admin:' + uid + ':' + requestId).digest('hex').slice(0, 32)
 return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}
function validReport(value: unknown): value is AdminReport {
 const r = value as AdminReport
 return !!r && idPattern.test(r.id) && typeof r.maskedName === 'string' && r.maskedName.includes('*') && r.maskedName.length <= 60 && /^\d{4}$/.test(r.phoneLast4) && Number.isSafeInteger(r.createdAt) && Number.isSafeInteger(r.updatedAt) && r.updatedAt >= r.createdAt && Number.isSafeInteger(r.expiresAt) && r.expiresAt === r.createdAt + archiveDays && ['pending','success','failed'].includes(r.status) && ['mock','gmail'].includes(r.mode) && errors.has(r.errorCode) && typeof r.pdfAvailable === 'boolean'
}
function queryInput(raw: unknown): AdminQuery {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !['from','to','status','cursor'].includes(k))) throw new AdminError('invalid-argument')
 const q = raw as AdminQuery
 for (const date of [q.from,q.to]) if (date !== undefined && date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) throw new AdminError('invalid-argument')
 if (q.from && q.to && q.from > q.to || q.status !== undefined && !['','pending','success','failed'].includes(q.status) || q.cursor !== undefined && (typeof q.cursor !== 'string' || q.cursor.length > 2048 || /[\r\n]/.test(q.cursor))) throw new AdminError('invalid-argument')
 return q
}
export interface DeliveryArchive {
 capture(input: Submission, pdf: Buffer, id: string, mode: 'mock' | 'gmail', filename?:string): Promise<void>
 update(id: string, status: AdminReport['status'], errorCode?: string): Promise<void>
}
export class ReportArchive implements DeliveryArchive {
 constructor(private store: ArchiveStore, private clock = Date.now,private project='yingyangtest') {if(!['yingyangtest','yingyangcheck'].includes(project))throw Error('Invalid archive project')}
 private async report(id: string) {
  if (!idPattern.test(id)) throw new AdminError('invalid-argument')
  const value = await this.store.read('logs/' + id + '.json')
  if (!value) return null
  try { const report: unknown = JSON.parse(value.bytes.toString()); if (!validReport(report) || report.id !== id) throw Error(); return { report, generation: value.generation } }
  catch { throw new AdminError('unavailable') }
  finally { value.bytes.fill(0) }
 }
 async capture(input: Submission, pdf: Buffer, id: string, mode: 'mock' | 'gmail', filename?:string) {
  if (!idPattern.test(id) || pdf.length > 1048576 || pdf.subarray(0,5).toString() !== '%PDF-') throw new AdminError('invalid-argument')
  const now = this.clock()
  let prior = await this.report(id)
  if (!prior) {
   const record: AdminReport = {id,maskedName:maskedName(input.name),phoneLast4:input.phone.slice(-4),createdAt:now,updatedAt:now,expiresAt:now+archiveDays,status:'pending',mode,errorCode:'',pdfAvailable:false}
   try { await this.store.write('logs/'+id+'.json',Buffer.from(JSON.stringify(record)),'application/json','0') } catch (error) { if (!(error instanceof ArchiveConflict)) throw error }
   prior = await this.report(id)
  }
  if (!prior || this.clock() >= prior.report.expiresAt) throw new AdminError('failed-precondition')
  const downloadName=filename||reportName(input.name,input.phone.slice(-4),new Date(prior.report.createdAt))
  if(!validReportName(downloadName))throw new AdminError('invalid-argument')
  try { await this.store.write('pdf/'+id+'.pdf',pdf,'application/pdf','0',downloadName) } catch (error) { if (!(error instanceof ArchiveConflict)) throw error }
  await this.modify(id, r => ({...r,pdfAvailable:true,status:'pending',errorCode:''}))
 }
 private async modify(id: string, change: (r: AdminReport) => AdminReport) {
  for (let i=0;i<3;i++) {
   const prior = await this.report(id)
   if (!prior) throw new AdminError('not-found')
   try { await this.store.write('logs/'+id+'.json',Buffer.from(JSON.stringify(change(prior.report))),'application/json',prior.generation); return }
   catch (error) { if (!(error instanceof ArchiveConflict)) throw error }
  }
  throw new AdminError('unavailable')
 }
 async update(id: string, status: AdminReport['status'], errorCode = '') {
  if (!errors.has(errorCode) || !['pending','success','failed'].includes(status)) throw new AdminError('invalid-argument')
  await this.modify(id, r=>({...r,status,errorCode,updatedAt:Math.max(r.updatedAt,this.clock())}))
 }
 private async audit(context: AdminContext, key: string, action: string, outcome: string, reportId?: string) {
  const record = { at:this.clock(), actor:createHmac('sha256',key).update('admin-access:'+context.uid).digest('hex'),action,outcome,...(reportId?{reportId}:{}) }
  await this.store.write('access/'+randomUUID()+'.json',Buffer.from(JSON.stringify(record)),'application/json','0')
 }
 async page(raw: unknown, context: AdminContext, key: string): Promise<AdminPage> {
  requireAdmin(context,this.project); const query = queryInput(raw), now = this.clock()
  const page = await this.store.list('logs/',query.cursor), reports: AdminReport[] = []
  for (const name of page.names) {
   const id = name.replace(/^logs\//,'').replace(/\.json$/,'')
   if (!idPattern.test(id)) continue
   const item = await this.report(id)
   if (!item) continue
   if (now >= item.report.expiresAt) { await this.store.remove('pdf/'+id+'.pdf'); continue }
   const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(item.report.updatedAt)
   if (query.from && day < query.from || query.to && day > query.to || query.status && query.status !== item.report.status) continue
   reports.push({...item.report})
  }
  await this.audit(context,key,'list','allowed')
  return {reports:reports.sort((a,b)=>b.updatedAt-a.updatedAt),...(page.nextCursor?{nextCursor:page.nextCursor}:{})}
 }
 async download(raw: unknown, context: AdminContext, key: string) {
  requireAdmin(context,this.project)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).join(',')!=='id' || !idPattern.test((raw as {id:string}).id)) throw new AdminError('invalid-argument')
  const id = (raw as {id:string}).id, item = await this.report(id)
  if (!item) { await this.audit(context,key,'download','not-found',id); throw new AdminError('not-found') }
  if (this.clock() >= item.report.expiresAt) { await this.store.remove('pdf/'+id+'.pdf'); await this.audit(context,key,'download','expired',id); throw new AdminError('failed-precondition') }
  if (!item.report.pdfAvailable) { await this.audit(context,key,'download','not-available',id); throw new AdminError('failed-precondition') }
  const file = await this.store.read('pdf/'+id+'.pdf')
  if (!file) { await this.audit(context,key,'download','not-found',id); throw new AdminError('not-found') }
  try {
   if(file.bytes.length>1048576||file.bytes.subarray(0,5).toString()!=='%PDF-')throw new AdminError('unavailable')
   await this.audit(context,key,'download','allowed',id)
   if (this.clock() >= item.report.expiresAt) { await this.store.remove('pdf/'+id+'.pdf'); throw new AdminError('failed-precondition') }
   const legacy=item.report.maskedName.replaceAll('*','').trim()||'검사결과'
   return {base64:file.bytes.toString('base64'),filename:validReportName(file.filename)?file.filename:reportName(legacy,item.report.phoneLast4,new Date(item.report.createdAt))}
  } finally { file.bytes.fill(0) }
 }
}
export class GcsArchiveStore implements ArchiveStore {
 constructor(private bucket = adminBucket, private token = runtimeToken, project='yingyangtest') { if (bucket!==(project==='yingyangcheck'?'yingyangcheck-admin-reports-231582543863':adminBucket)) throw Error('Staging archive only') }
 private async request(url: string, options: RequestInit = {}) { return fetch(url,{...options,headers:{authorization:'Bearer '+await this.token(),...options.headers},signal:AbortSignal.timeout(8000)}) }
 private object(name: string) { if (!/^(logs\/[a-f0-9-]+\.json|pdf\/[a-f0-9-]+\.pdf|access\/[a-f0-9-]+\.json)$/.test(name)) throw Error('Invalid archive path'); return 'https://storage.googleapis.com/storage/v1/b/'+this.bucket+'/o/'+encodeURIComponent(name) }
 async read(name: string) {
  const r = await this.request(this.object(name)+'?alt=media'); if(r.status===404)return null; if(!r.ok)throw Error('Archive read failed')
  const generation = r.headers.get('x-goog-generation'); if(!generation)throw Error('Archive version missing')
  const bytes=Buffer.from(await r.arrayBuffer())
  try{let filename: string|undefined;if(name.startsWith('pdf/')){const meta=await this.request(this.object(name)+'?fields=metadata,generation');if(!meta.ok)throw Error('Metadata unavailable');const m=await meta.json() as {generation:string;metadata?:{filename?:string}};if(m.generation!==generation)throw Error('Object changed');filename=m.metadata?.filename}return {bytes,generation,filename}}catch(e){bytes.fill(0);throw e}
 }
 async write(name: string, bytes: Buffer, contentType: string, generation: string, filename?:string) {
  this.object(name)
  if(filename&&!validReportName(filename))throw Error('Invalid filename')
  const boundary='yy-'+randomUUID(),body=filename?Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name,metadata:{filename}})+'\r\n--'+boundary+'\r\nContent-Type: '+contentType+'\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--')]):undefined
  let r:Response
  try{r=await this.request('https://storage.googleapis.com/upload/storage/v1/b/'+this.bucket+'/o?uploadType='+(filename?'multipart':'media')+'&name='+encodeURIComponent(name)+'&ifGenerationMatch='+generation,{method:'POST',headers:{'content-type':filename?'multipart/related; boundary='+boundary:contentType},body:new Uint8Array(body||bytes)})}finally{body?.fill(0)}
  if(r.status===412)throw new ArchiveConflict();if(!r.ok)throw Error('Archive write failed')
 }
 async remove(name: string) { const r=await this.request(this.object(name),{method:'DELETE'});if(!r.ok&&r.status!==404)throw Error('Archive delete failed') }
 async list(prefix: string, cursor?: string) {
  if(prefix!=='logs/')throw Error('Invalid archive prefix')
  const r=await this.request('https://storage.googleapis.com/storage/v1/b/'+this.bucket+'/o?prefix=logs%2F&maxResults=50'+(cursor?'&pageToken='+encodeURIComponent(cursor):''));if(!r.ok)throw Error('Archive list failed')
  const b=await r.json() as {items?:{name:string}[];nextPageToken?:string};return {names:(b.items||[]).map(x=>x.name),nextCursor:b.nextPageToken}
 }
}
