export type AdminStatus = 'pending' | 'success' | 'failed'
export type AdminReport = { id: string; maskedName: string; phoneLast4: string; createdAt: number; updatedAt: number; expiresAt: number; status: AdminStatus; mode: 'mock' | 'gmail'; errorCode: string; pdfAvailable: boolean }
export type AdminQuery = { from?: string; to?: string; status?: AdminStatus | ''; cursor?: string }
export type AdminPage = { reports: AdminReport[]; nextCursor?: string }
export type AdminDownload = { base64: string; filename: string }
