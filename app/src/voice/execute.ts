import { parseCommand, EXAMPLES, type Command } from '../../../landing/vita/commands.js'
import { vitaSay, vitaStop } from '../audio/voice'
import { useSound } from '../audio/sfx'
import { exitTour, skipChapter } from '../tour/director'
import { useTour } from '../tour/store'
import { runAction, sendQuestion, useVita, type Go } from '../vita/store'

/** What the executor needs from the page it runs in. */
export interface Ctx {
  go: Go
  /** Browser history: -1 back, 1 forward. */
  history: (delta: number) => void
  pathname: string
  /** Voice mode off (from "stop listening"). */
  voiceOff: () => void
}

export const where = (pathname: string) => (pathname.startsWith('/cabin') ? 'cabin' : 'console')

const scrollMain = (to: 'top' | 'bottom' | number) => {
  const el = document.getElementById('main') ?? document.scrollingElement
  if (!el) return
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  el.scrollTo({ top: to === 'top' ? 0 : to === 'bottom' ? el.scrollHeight : el.scrollTop + to * el.clientHeight * 0.8, behavior })
}

const setSound = (on: boolean) => { if (useSound.getState().on !== on) useSound.getState().toggle() }

/** Run one parsed command. Returns the line to show in the indicator (also spoken, with Sound on). */
export function execute(c: Command, ctx: Ctx): string {
  const say = (t: string) => { if (t) void vitaSay(t); return t }
  if (c.type === 'action') {
    runAction(c.action, ctx.go)
    return say(c.say)
  }
  switch (c.name) {
    case 'back': ctx.history(-1); return say(c.say)
    case 'forward': ctx.history(1); return say(c.say)
    case 'scroll-down': scrollMain(1); return ''
    case 'scroll-up': scrollMain(-1); return ''
    case 'scroll-top': scrollMain('top'); return ''
    case 'scroll-bottom': scrollMain('bottom'); return ''
    case 'stop-talking': vitaStop(); return ''
    case 'sound-on': setSound(true); return say(c.say)
    case 'sound-off': setSound(false); return 'Sound off.'
    case 'close': useVita.setState({ open: false }); vitaStop(); return ''
    case 'next': useTour.getState().cabin?.step?.(1); return ''
    case 'previous': useTour.getState().cabin?.step?.(-1); return ''
    case 'tour-pause': useTour.getState().set({ paused: true }); return say(c.say)
    case 'tour-resume': useTour.getState().set({ paused: false }); return ''
    case 'tour-skip': skipChapter(); return ''
    case 'tour-exit': exitTour(); return say(c.say)
    case 'home': window.location.assign('/'); return ''
    case 'story': window.location.assign('/story.html'); return say(c.say)
    case 'voice-off': ctx.voiceOff(); return c.say
    case 'follow': {
      const last = [...useVita.getState().messages].reverse().find((m) => m.role === 'assistant' && m.actions?.length)
      if (last?.actions?.[0]) { runAction(last.actions[0], ctx.go); return say(`${last.actions[0].label}.`) }
      return say('Tell me where to go, for example open alerts.')
    }
    case 'help': return say(`You can say: ${EXAMPLES.join(', ')}. Anything else, I will answer.`)
    default: return ''
  }
}

/** A finished phrase: a command if it is one, otherwise a question for VITA (the panel opens to show the answer). */
export function handleSpeech(text: string, ctx: Ctx): { kind: 'command' | 'question'; line: string } {
  const c = parseCommand(text, { where: where(ctx.pathname) })
  if (c) return { kind: 'command', line: execute(c, ctx) }
  if (!ctx.pathname.startsWith('/doctor')) useVita.setState({ open: true })
  void sendQuestion(text, ctx.pathname, ctx.go)
  return { kind: 'question', line: '' }
}
