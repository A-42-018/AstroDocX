import { describe, expect, it } from 'vitest'
import { c, IsolationForest } from './isolationForest'

describe('IsolationForest', () => {
  it('calculates average path length c(n)', () => {
    expect(c(0)).toBe(0)
    expect(c(1)).toBe(0)
    expect(c(2)).toBe(1)
    expect(c(256)).toBeGreaterThan(7)
  })

  it('is deterministic when initialized with the same seed', () => {
    const data = [
      [10, 20], [11, 21], [10, 22], [9, 19], [12, 20],
      [100, 200], // Anomaly
    ]

    const forest1 = new IsolationForest(50, 123)
    forest1.fit(data)
    const scores1 = forest1.scores(data)

    const forest2 = new IsolationForest(50, 123)
    forest2.fit(data)
    const scores2 = forest2.scores(data)

    expect(scores1).toEqual(scores2)
  })

  it('assigns higher anomaly score to outliers', () => {
    // Normal cluster around [0, 0]
    const data: number[][] = []
    for (let i = 0; i < 50; i++) {
      data.push([Math.sin(i) * 2, Math.cos(i) * 2])
    }
    // Far outlier
    const outlier = [50, 50]
    data.push(outlier)

    const forest = new IsolationForest(100, 42)
    forest.fit(data)

    const normalScore = forest.score([0, 0], data.length)
    const outlierScore = forest.score(outlier, data.length)

    expect(outlierScore).toBeGreaterThan(normalScore)
    expect(outlierScore).toBeGreaterThan(0.6)
  })
})
