// Voice navigation grammar, shared by NOVA (landing/briefing) and VITA (app/src/voice). No build step, no DOM.
//
//   parseCommand('take me to the alerts', { where: 'home' })
//     -> { type: 'action', action: { label: 'Open Alerts', kind: 'console', target: '/alerts' }, say: 'Opening Alerts.' }
//   parseCommand('scroll down')      -> { type: 'local', name: 'scroll-down', say: '' }
//   parseCommand('what are alerts')  -> null   (not a command: the caller sends it to the guide's Q&A)
//
// `where` is 'home' | 'console' | 'cabin' | 'story'. Actions use the same { label, kind, target } shape as ask.js,
// so the existing executors run them unchanged and every target satisfies ask.js's cleanAction().

/** Console screens (mirrors app/src/shell/nav.ts ROUTES; a test keeps them in step). */
export const SCREENS = [
  { path: '/board', label: 'Status Board', say: 'Status Board', aliases: ['status board', 'board', 'dashboard'] },
  { path: '/doctor', label: 'Crew Doctor', say: 'the Crew Doctor', aliases: ['crew doctor', 'doctor'] },
  { path: '/alerts', label: 'Alerts', say: 'Alerts', aliases: ['alerts', 'alert', 'warnings'] },
  { path: '/trends', label: 'Trends', say: 'Trends', aliases: ['trends', 'trend', 'charts'] },
  { path: '/checkin', label: 'Check-in', say: 'Check-in', aliases: ['check in', 'checkin', 'daily check in', 'face scan', 'scan'] },
  { path: '/simulator', label: 'Simulator', say: 'the Simulator', aliases: ['simulator', 'simulation'] },
  { path: '/sync', label: 'Ground Sync', say: 'Ground Sync', aliases: ['ground sync', 'sync'] },
  { path: '/ground', label: 'Ground View', say: 'Ground View', aliases: ['ground view', 'ground', 'mission control'] },
  { path: '/nasa', label: 'NASA Data', say: 'NASA Data', aliases: ['nasa data', 'nasa'] },
]

/** Named stops in the 3D cabin (mirrors SHOTS in app/src/cabin/CabinPage.tsx). */
export const CABIN_STOPS = {
  helmet: ['helmet'],
  crew: ['crew'],
  board: ['board', 'status board'],
  vitals: ['vitals', 'live vitals'],
  alerts: ['alerts'],
  trends: ['trends'],
  window: ['window'],
  eva: ['eva', 'spacewalk', 'outside'],
}

/** NASA Library collections (mirrors LIBRARY in ask.js). */
export const LIBRARY = {
  'bone-muscle': ['bone', 'muscle', 'bone and muscle'],
  radiation: ['radiation'],
  'sleep-isolation': ['sleep', 'isolation', 'sleep and isolation'],
  'twins-study': ['twins study', 'twins', 'twin study'],
  'life-support': ['life support', 'co2', 'carbon dioxide'],
  spacewalks: ['spacewalks', 'spacewalk'],
}

/** Story-page chapters. */
const SECTIONS = {
  universe: ['universe', 'intro', 'beginning'],
  twin: ['health twin', 'digital twin', 'twin'],
  astrodocx: ['astrodocx', 'astro docx'],
}

const WAKE = /^(?:(?:hey|ok|okay)\s+)?(?:nova|vita)\b\s*/
const POLITE = /^(?:please|can you|could you|would you|will you|i want to|i would like to|i d like to|lets|let us)\s+/
const VERB = /^(?:take me to|bring me to|take me|go to|navigate to|switch to|jump to|show me|show|open up|open|launch|start|see|visit|enter|walk through)\s+/
const FILLER = /^(?:the|a|my|our|to|me)\s+/
const QUESTION = /^(?:what|why|how|who|when|where|which|does|do|is|are|tell|explain|define)\b/

const words = (s) => (s ? s.split(' ').length : 0)
const has = (text, alias) => new RegExp(`(?:^| )${alias}(?: |$)`).test(text)
const local = (name, say = '', arg) => ({ type: 'local', name, say, ...(arg ? { arg } : {}) })
const act = (kind, target, label, say) => ({ type: 'action', action: { label, kind, target }, say })

/** Longest alias wins, so "ground sync" beats "sync" and "status board" beats "board". */
function pick(table, text) {
  let best = null, len = 0
  for (const [key, aliases] of Object.entries(table)) {
    for (const a of aliases) if (a.length > len && has(text, a)) { best = key; len = a.length }
  }
  return best
}

/** Parse what was said. Returns a command, or null when it is not one (a question for the guide). */
export function parseCommand(input, { where = 'console' } = {}) {
  let t = String(input ?? '').toLowerCase().normalize('NFC').replace(/['’]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  t = t.replace(WAKE, '').replace(/\s+(?:please|for me|now)$/, '').trim()
  let raw = t
  for (let i = 0; i < 3; i++) { const n = raw.replace(POLITE, ''); if (n === raw) break; raw = n }
  if (!raw) return null

  /* ---- things that are the whole utterance ---- */
  if (/^(?:help|what can i say|voice commands|list commands|what commands)$/.test(raw)) return local('help')
  if (/^(?:stop listening|voice mode off|turn off voice mode|turn voice mode off|mic off|stop voice mode|stop voice navigation)$/.test(raw)) return local('voice-off', 'Voice mode off.')
  if (/^(?:stop|stop talking|be quiet|quiet|silence|hush|shut up|enough)$/.test(raw)) return local('stop-talking')
  if (/^(?:mute|sound off|turn (?:the )?sound off|mute (?:the )?sound|voice off)$/.test(raw)) return local('sound-off')
  if (/^(?:unmute|sound on|turn (?:the )?sound on|voice on)$/.test(raw)) return local('sound-on', 'Sound on.')
  if (/^(?:go )?back$|^previous page$/.test(raw)) return local('back', 'Going back.')
  if (/^(?:go )?forward$/.test(raw)) return local('forward', 'Going forward.')
  if (/^scroll (?:down|further)$|^page down$/.test(raw)) return local('scroll-down')
  if (/^scroll up$|^page up$/.test(raw)) return local('scroll-up')
  if (/^(?:scroll to |go to |back to )?(?:the )?top$|^scroll to (?:the )?start$/.test(raw)) return local('scroll-top')
  if (/^(?:scroll to |go to )?(?:the )?bottom$|^scroll to (?:the )?end$/.test(raw)) return local('scroll-bottom')
  if (/^(?:yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|open it|take me there|go there|show me|lets go)$/.test(raw)) return local('follow')
  if (/^skip (?:the )?(?:intro|briefing)$/.test(raw)) return local('skip-intro')
  if (/^(?:pause|hold on|wait)(?: the)?(?: tour)?$/.test(raw)) return local('tour-pause', 'Paused.')
  if (/^(?:resume|continue|carry on|keep going|play)(?: the)?(?: tour)?$/.test(raw)) return local('tour-resume')
  if (/^skip(?: (?:this|the|chapter|ahead|step|chapter ahead))*$/.test(raw)) return local('tour-skip', 'Skipping ahead.')
  if (/^(?:exit|stop|end|quit|cancel|leave) (?:the )?tour$/.test(raw)) return local('tour-exit', 'Ending the tour.')
  if (/^next(?: stop| one)?$/.test(raw)) return local('next')
  if (/^(?:previous|prev|previous stop|last one)$/.test(raw)) return local('previous')
  if (/^(?:close|dismiss|go away|leave|exit)(?: (?:this|that|it|the library|library|the panel|panel|chat|the chat|dialog|window|screen|vita|nova))?$/.test(raw)) return local('close')
  if (/^(?:go )?(?:home|to home|landing page|homepage|home page)$|^back to (?:the )?(?:landing page|homepage|home page|home)$/.test(raw)) return local('home')
  if (/^(?:the )?(?:story|story page|scroll story|scrolling story)$/.test(raw) || /^(?:open |go to |show )(?:the )?story(?: page)?$/.test(raw)) return local('story', 'Opening the story.')

  /* ---- navigation: optional verb, then a place ---- */
  let n = raw, verb = false
  for (let i = 0; i < 4; i++) {
    const s = n.replace(VERB, '').replace(FILLER, '')
    if (s === n) break
    if (VERB.test(n)) verb = true
    n = s
  }
  if (!n || QUESTION.test(n)) return null
  const limit = verb ? 6 : 4
  if (words(n) > limit) return null

  if (where === 'story') {
    const sec = pick(SECTIONS, n)
    if (sec) return local('section', `Going to ${sec === 'twin' ? 'the health twin' : sec === 'universe' ? 'the universe' : 'AstroDocX'}.`, sec)
    if (/^(?:footer|end)$/.test(n)) return local('scroll-bottom')
  }

  if (/^(?:leave|exit|quit) (?:the )?(?:cabin|station)$|^(?:back to )?(?:the )?console$/.test(n)) return act('console', '/board', 'Open the console', 'Opening the console.')

  const lib = /\blibrary\b|\bresearch\b/.test(n)
  if (lib) {
    const target = pick(LIBRARY, n)
    return act('library', target ?? '', target ? `Open the ${target.replace('-', ' and ')} library` : 'Open the NASA Library', 'Opening the NASA Library.')
  }

  if (/\btour\b/.test(n)) return act('tour', '', 'Take the tour', 'Sure, follow me.')

  const cabinWord = /\b(?:cabin|station|3d|space station)\b/.test(n)
  const stop = pick(CABIN_STOPS, n)
  if (cabinWord || where === 'cabin') {
    if (stop && (cabinWord || where === 'cabin')) return act('cabin', stop, `Go to the ${stop} in the cabin`, `Going to the ${stop}.`)
    if (cabinWord) return act('cabin', '', 'Walk the station', 'Walking the station.')
  }

  const path = pick(Object.fromEntries(SCREENS.map((s) => [s.path, s.aliases])), n)
  if (path) {
    const s = SCREENS.find((x) => x.path === path)
    return act('console', path, `Open ${s.label}`, `Opening ${s.say}.`)
  }
  return null
}

/** A few examples the guide can read out for "what can I say". */
export const EXAMPLES = ['open alerts', 'walk the station', 'open the radiation library', 'go back', 'scroll down', 'take the tour', 'stop listening']
