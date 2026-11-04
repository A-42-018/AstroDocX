/** VITA's shared client, written in plain JS for the landing page (no build step there) and imported as it is. */
declare module '*/landing/vita/ask.js' {
  export interface AskCitation { label: string; url: string }
  export interface AskAction { label: string; kind: 'console' | 'cabin' | 'library' | 'tour'; target: string }
  export interface AskResult { text: string; citations: AskCitation[]; actions: AskAction[]; source: 'live' | 'offline' }
  export function ask(question: string, opts?: { history?: { role: string; text: string }[]; page?: string }): Promise<AskResult>
}
