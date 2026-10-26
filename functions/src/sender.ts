export type Attachment = { filename: string; content: Buffer }
export interface Sender { send(attachment: Attachment, options: { fail: boolean }): Promise<void> }
export const mockSender: Sender = {
 async send(attachment, options) {
  if (!attachment.filename.endsWith('.pdf') || attachment.content.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid mock attachment')
  if (options.fail) throw new Error('Simulated send failure')
 },
}
