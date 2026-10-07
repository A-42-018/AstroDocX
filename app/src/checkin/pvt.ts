/**
 * Brief psychomotor vigilance test (PVT). The reference test is the 3-minute PVT-B used on the ISS
 * (Basner, Mollicone & Dinges 2011, Acta Astronautica 69:949-959); lapses are responses slower than 500 ms.
 * This 5-trial version is a shortened, illustrative stand-in for a quick daily check.
 */
export const TRIALS = 5
export const LAPSE_MS = 500
/** Responses faster than this cannot be a reaction to the stimulus: counted as false starts. */
export const MIN_VALID_MS = 100
/** Random wait before each stimulus (illustrative range, ms). */
export const WAIT_MS: [number, number] = [1500, 5000]
/** Trials needed for a result to count as a reaction-time reading. */
export const MIN_VALID_TRIALS = 3

export interface PvtSummary {
  /** Median of valid trials, ms (null when too few valid trials). */
  medianMs: number | null
  valid: number
  lapses: number
  falseStarts: number
}

/** `trials`: reaction time in ms for each attempt, or 'early' when the crew member tapped before the stimulus. */
export function summarize(trials: (number | 'early')[]): PvtSummary {
  const falseStarts = trials.filter((t) => t === 'early' || t < MIN_VALID_MS).length
  const ok = trials.filter((t): t is number => t !== 'early' && t >= MIN_VALID_MS).sort((a, b) => a - b)
  const mid = Math.floor(ok.length / 2)
  const median = ok.length === 0 ? 0 : ok.length % 2 ? ok[mid] : (ok[mid - 1] + ok[mid]) / 2
  return {
    medianMs: ok.length >= MIN_VALID_TRIALS ? Math.round(median) : null,
    valid: ok.length,
    lapses: ok.filter((t) => t > LAPSE_MS).length,
    falseStarts,
  }
}
