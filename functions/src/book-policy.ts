import { randomUUID } from 'node:crypto'
import type { StateStore } from './mail-state'
import type { BookSettings } from '../../src/book-settings'
import { defaultBooks } from '../../src/book-settings'
import { InputError } from './submission'

const path = 'questionnaires/settings'
export function validBooks(raw: unknown): BookSettings {
 const b = raw as BookSettings
 if (!b || Object.keys(b).sort().join(',') !== 'currentEnabled,legacyEnabled,revision' || typeof b.currentEnabled !== 'boolean' || typeof b.legacyEnabled !== 'boolean' || !b.currentEnabled && !b.legacyEnabled || typeof b.revision !== 'string') throw new InputError('Invalid book settings')
 return b
}
export async function readBooks(store: StateStore) { const data = await store.read<BookSettings>(path); return data ? validBooks(data.value) : { ...defaultBooks } }
export async function requireBook(store: StateStore, input: { version?: number; questionnaire?: string }) {
 const settings = await readBooks(store)
 const current = input.questionnaire === 'sasang-80' || input.version === 2
 if (current ? !settings.currentEnabled : !settings.legacyEnabled) throw new InputError('Questionnaire disabled')
}
export async function manageBooks(store: StateStore, data: Record<string, unknown>, role: string, authTime: number, now = Date.now()) {
 if (role !== 'master') throw new InputError('Master required')
 if (Object.keys(data).length === 0) return { books: await readBooks(store) }
 if (Object.keys(data).sort().join(',') !== 'currentEnabled,legacyEnabled,revision' || !Number.isFinite(authTime) || now / 1000 - authTime < 0 || now / 1000 - authTime > 300) throw new InputError('Recent master authentication required')
 const next = validBooks(data), prior = await store.read<BookSettings>(path), current = prior ? validBooks(prior.value) : defaultBooks
 if (next.revision !== current.revision) throw new InputError('Book settings changed')
 const books = { ...next, revision: randomUUID() }; await store.write(path, books, prior?.generation || '0'); return { books }
}
