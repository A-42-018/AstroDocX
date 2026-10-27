import type { Status } from '../data/types'

export const STATUS_WORD: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }
export const STATUS_SHORT: Record<Status, string> = { nominal: 'NOM', watch: 'WATCH', act: 'ACT' }
