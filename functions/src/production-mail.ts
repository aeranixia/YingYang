import { validReportName } from './report-name'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { MailConfig } from './gmail-sender'
import type { Attachment } from './sender'
import type { StateStore } from './mail-state'
import { canonicalSubmission, type MailProtocol } from './live-service'
import { mockOperation } from './admin-reports'
import { validateSubmission } from './submission'
import { productionPdfConsentVersion } from '../../src/production/contracts'

export type ProductionMailConfig=MailConfig&{enabled:boolean;refresh_token:string;refreshTokenExpiresAt?:string}
export const productionProtocol:MailProtocol={
 validate:raw=>validateSubmission(raw,productionPdfConsentVersion,false),
 operation:(input,uid,key)=>mockOperation(uid,'production:'+JSON.stringify([...(input.version===2?['sasang-80']:[]),input.completionProof||null,input.acquired,input.innate]),key),
 canonical:input=>canonicalSubmission({...input,requestId:'',privacyProof:undefined}),
}
export function validateProductionMail(raw:unknown,now=Date.now()):ProductionMailConfig{
 const c=raw as ProductionMailConfig
 if(!c||c.enabled!==true||c.projectId!=='yingyangcheck'||c.mode!=='production'||typeof c.sender!=='string'||!/^[-\w.+]+@gmail\.com$/.test(c.sender)||typeof c.recipient!=='string'||!/^[-\w.+]+@[-\w.]+\.[a-zA-Z]{2,}$/.test(c.recipient)||!c.client_id?.startsWith('231582543863-')||!c.client_id.endsWith('.apps.googleusercontent.com')||typeof c.client_secret!=='string'||!c.client_secret||typeof c.refresh_token!=='string'||!c.refresh_token)throw Error('Production mail unavailable')
 if(c.allowSendUntil&&(!Number.isFinite(Date.parse(c.allowSendUntil))||Date.parse(c.allowSendUntil)<=now)||c.refreshTokenExpiresAt&&(!Number.isFinite(Date.parse(c.refreshTokenExpiresAt))||Date.parse(c.refreshTokenExpiresAt)<=now))throw Error('Production mail unavailable')
 return {...c,allowSendUntil:c.allowSendUntil||'9999-12-31T23:59:59.999Z'}
}
export async function activeProductionMail(raw:unknown,enabled:boolean,store:StateStore,now=Date.now()){
 if(!enabled)throw Error('Production mail disabled')
 const c=validateProductionMail(raw,now),control=await store.read<{enabled?:boolean;until?:string}>('v1/control/mail')
 if(control?.value.enabled!==true||control.value.until&&(!Number.isFinite(Date.parse(control.value.until))||Date.parse(control.value.until)<=now))throw Error('Production mail disabled')
 return c
}
export async function productionAccess(raw:MailConfig){
 const c=validateProductionMail(raw),r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(5000)})
 if(!r.ok)throw Error('Authorization unavailable')
 const b=await r.json() as {access_token?:string;scope?:string}
 if(!b.access_token||b.scope&&!b.scope.split(' ').includes('https://www.googleapis.com/auth/gmail.send'))throw Error('Authorization unavailable')
 return b.access_token
}
export async function composeProductionMail(raw:MailConfig,attachment:Attachment,operation:string){
 const c=validateProductionMail(raw)
 if(!/^[a-f0-9-]{36}$/.test(operation)||!validReportName(attachment.filename)||attachment.content.length>1048576||attachment.content.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid attachment')
 return new MailComposer({from:c.sender,to:c.recipient,subject:'YingYang 검사 결과',text:'검사 결과 PDF를 첨부합니다. 업무 담당자만 확인해 주세요.',messageId:'<'+operation+'@yingyangcheck.web.app>',attachments:[{filename:attachment.filename,content:attachment.content,contentType:'application/pdf'}],disableFileAccess:true,disableUrlAccess:true}).compile().build()
}
export async function productionDispatch(c:MailConfig,attachment:Attachment,operation:string,token:string){
 const bytes=await composeProductionMail(c,attachment,operation)
 try{const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({raw:bytes.toString('base64url')}),signal:AbortSignal.timeout(10000)});if(!r.ok||!(await r.json() as {id?:string}).id)throw Error('Outcome unknown')}finally{bytes.fill(0)}
}
