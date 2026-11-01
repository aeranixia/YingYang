import { pdfDelivery } from '../staging/privacy-copy'

export const productionPdfDelivery=pdfDelivery.replace('Gmail API와 네이버 메일을 사용합니다.','Gmail API와 Gmail을 사용합니다.')
