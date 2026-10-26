import MailComposer from 'nodemailer/lib/mail-composer'
import { runtimeToken } from './mail-state'
import type { Attachment } from './sender'

export type MailConfig = { projectId: string; mode: string; sender: string; recipient: string; allowSendUntil: string; client_id: string; client_secret: string }
export async function readMailSecret(name: 'STAGING_GMAIL_CLIENT' | 'STAGING_GMAIL_REFRESH_TOKEN'): Promise<string> {
 const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/yingyangtest/secrets/${name}/versions/latest:access`, { headers: { authorization: `Bearer ${await runtimeToken()}` }, signal: AbortSignal.timeout(5000) })
 if (!response.ok) throw new Error('Mail configuration unavailable')
 const body = await response.json() as { payload?: { data?: string } }
 if (!body.payload?.data) throw new Error('Mail configuration unavailable')
 return Buffer.from(body.payload.data, 'base64').toString('utf8')
}
export function validateMailConfig(raw: unknown, now = Date.now()): MailConfig {
 const config = raw as MailConfig
 if (!config || config.projectId !== 'yingyangtest' || config.mode !== 'gmail-test' || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(config.sender) || !/^[a-zA-Z0-9._%+-]+@naver\.com$/.test(config.recipient) || !config.client_id?.endsWith('.apps.googleusercontent.com') || typeof config.client_secret !== 'string' || !config.client_secret || !Number.isFinite(Date.parse(config.allowSendUntil)) || Date.parse(config.allowSendUntil) <= now || Date.parse(config.allowSendUntil) > now + 3600000) throw new Error('Mail test window is disabled')
 return config
}
export async function refreshGmailToken(config: MailConfig): Promise<string> {
 const refresh = await readMailSecret('STAGING_GMAIL_REFRESH_TOKEN')
 const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.client_id, client_secret: config.client_secret, refresh_token: refresh.trim(), grant_type: 'refresh_token' }), signal: AbortSignal.timeout(5000) })
 if (!response.ok) throw new Error('Gmail authorization unavailable')
 const body = await response.json() as { access_token?: string; scope?: string }
 if (!body.access_token || (body.scope && !body.scope.split(' ').includes('https://www.googleapis.com/auth/gmail.send'))) throw new Error('Gmail authorization unavailable')
 return body.access_token
}
export async function composeTestMail(config: Pick<MailConfig, 'sender' | 'recipient'>, attachment: Attachment, operation: string): Promise<Buffer> {
 if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(config.sender) || !/^[a-zA-Z0-9._%+-]+@naver\.com$/.test(config.recipient) || !/^[0-9a-f-]{36}$/.test(operation)) throw new Error('Invalid test envelope')
 if (!/^[\p{L}\p{N} -]{1,30}_\d{4}\.pdf$/u.test(attachment.filename) || attachment.content.length > 1048576 || attachment.content.subarray(0,5).toString() !== '%PDF-') throw new Error('Invalid test attachment')
 return new MailComposer({ from: config.sender, to: config.recipient, subject: '[STAGING] YingYang 가상 검사 결과', text: '가상 검진 자료의 테스트 발송입니다. 실제 상담 접수가 아닙니다. 확인 후 테스트 메일과 첨부 사본을 정리해 주세요.', messageId: `<${operation}@yingyangtest.web.app>`, attachments: [{ filename: attachment.filename, content: attachment.content, contentType: 'application/pdf' }], disableFileAccess: true, disableUrlAccess: true }).compile().build()
}
export async function dispatchGmail(config: MailConfig, attachment: Attachment, operation: string, accessToken: string): Promise<void> {
 validateMailConfig(config)
 const mime = await composeTestMail(config, attachment, operation)
 try {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw: mime.toString('base64url') }), signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('Gmail outcome not confirmed')
  const body = await response.json() as { id?: string }
  if (typeof body.id !== 'string' || !body.id) throw new Error('Gmail outcome not confirmed')
 } finally { mime.fill(0) }
}
