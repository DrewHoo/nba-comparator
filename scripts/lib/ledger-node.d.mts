import type { ColName, Ledger, LedgerFile } from '../../src/lib/ledger.ts'
export function readLedgerFile(): LedgerFile
export function readCols(names?: ColName[] | null): Partial<Record<ColName, Uint8Array>>
export function loadLedger(): Ledger
