// POST /api/ask  { question, history?: [{ role: 'user'|'assistant', text }], page? }
// -> { text, citations: [{label,url}], actions: [{label,kind,target}], source: 'live' }
// 503 when ANTHROPIC_API_KEY is not set; the browser client then answers offline. See docs/vita.md.
import { createHandler, defaultGetClient } from './_vita.js'

export default createHandler({ getClient: defaultGetClient })
