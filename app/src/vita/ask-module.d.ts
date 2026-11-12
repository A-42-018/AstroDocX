/** VITA's shared client, written in plain JS for the landing page (no build step there) and imported as it is. */
declare module '*/landing/vita/ask.js' {
  export interface AskCitation { label: string; url: string }
  export interface AskAction { label: string; kind: 'console' | 'cabin' | 'library' | 'tour'; target: string }
  export interface AskResult { text: string; citations: AskCitation[]; actions: AskAction[]; source: 'live' | 'offline' }
  export function ask(question: string, opts?: { history?: { role: string; text: string }[]; page?: string }): Promise<AskResult>
}

/** Voice navigation grammar, shared with the landing page (landing/vita/commands.js). */
declare module '*/landing/vita/commands.js' {
  import type { AskAction } from '*/landing/vita/ask.js'
  export type Command =
    | { type: 'action'; action: AskAction; say: string }
    | { type: 'local'; name: string; say: string; arg?: string }
  export function parseCommand(text: string, opts?: { where?: 'home' | 'console' | 'cabin' | 'story' }): Command | null
  export const SCREENS: { path: string; label: string; say: string; aliases: string[] }[]
  export const CABIN_STOPS: Record<string, string[]>
  export const LIBRARY: Record<string, string[]>
  export const EXAMPLES: string[]
}

/** The speech-recognition controller shared with the landing page (landing/vita/listen.js). */
declare module '*/landing/vita/listen.js' {
  export type ListenState = 'idle' | 'listening' | 'paused' | 'denied'
  export interface Listener {
    readonly supported: boolean
    readonly state: ListenState
    readonly handsFree: boolean
    once(): void
    setHandsFree(on: boolean): void
    pause(reason: string): void
    resume(reason: string): void
    stop(): void
  }
  export function createListener(o: { onInterim?: (t: string) => void; onFinal?: (t: string) => void; onState?: (s: ListenState) => void; onError?: (code: string) => void; SR?: unknown; lang?: string; wait?: (f: () => void, ms: number) => unknown }): Listener
  export function recognitionCtor(): unknown
  export const voiceModePref: { get(): boolean; set(on: boolean): void }
}
