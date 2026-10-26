const { createSubmissionService } = require('../../lib/functions/src/service')
const { mockSender } = require('../../lib/functions/src/sender')
const service = createSubmissionService(mockSender, Date.now, async () => {
 if (process.env.TEST_HANG === '1') return new Promise(() => {})
 return Buffer.from('%PDF-test')
})
process.on('message', async data => {
 process.send({ started: true })
 try { process.send(await service(data, 'synthetic-tester', 'local-test-signing-key')) }
 catch { process.send({ failed: true }) }
})
