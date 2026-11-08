import { rng } from '../data/synthetic'

export interface IsolationNode {
  size: number
  isLeaf: boolean
  splitFeature?: number
  splitValue?: number
  left?: IsolationNode
  right?: IsolationNode
}

/**
 * Average path length of unsuccessful searches in a Binary Search Tree (BST),
 * approximating the average depth of an isolation tree over a sample of size n.
 */
export function c(n: number): number {
  if (n <= 1) return 0
  if (n === 2) return 1
  const eulerMascheroni = 0.5772156649
  return 2 * (Math.log(n - 1) + eulerMascheroni) - (2 * (n - 1)) / n
}

/**
 * Deterministic on-device Isolation Forest for tabular anomaly detection.
 * Uses seeded mulberry32 PRNG from synthetic.ts for full determinism.
 */
export class IsolationForest {
  private trees: IsolationNode[] = []
  private subSampleSize: number
  private numTrees: number
  private random: ReturnType<typeof rng>

  constructor(
    numTrees = 100,
    seed = 42,
    subSampleSize = 256
  ) {
    this.numTrees = numTrees
    this.subSampleSize = subSampleSize
    this.random = rng(seed)
  }

  /**
   * Train the forest on an array of feature vectors X (shape: N x d).
   */
  fit(X: number[][]): this {
    this.trees = []
    const n = X.length
    if (n === 0) return this

    const psi = Math.min(this.subSampleSize, n)
    const maxDepth = Math.ceil(Math.log2(Math.max(psi, 2)))

    for (let t = 0; t < this.numTrees; t++) {
      const sample = this.drawSample(X, psi)
      this.trees.push(this.buildTree(sample, 0, maxDepth))
    }

    return this
  }

  /**
   * Score a single feature vector x. Returns an anomaly score in [0, 1].
   * Values close to 1 indicate an anomaly; values < 0.5 indicate normal behavior.
   */
  score(x: number[], n: number = this.subSampleSize): number {
    if (this.trees.length === 0) return 0.5
    const avgPath = this.trees.reduce((acc, t) => acc + this.pathLength(x, t, 0), 0) / this.trees.length
    const cPsi = c(n)
    if (cPsi === 0) return 0.5
    return 2 ** (-avgPath / cPsi)
  }

  /**
   * Score an array of feature vectors.
   */
  scores(X: number[][]): number[] {
    const n = Math.min(this.subSampleSize, X.length)
    return X.map((x) => this.score(x, n))
  }

  private drawSample(X: number[][], size: number): number[][] {
    const indices: number[] = []
    const n = X.length
    if (n <= size) {
      return [...X]
    }
    const chosen = new Set<number>()
    while (chosen.size < size) {
      const idx = Math.floor(this.random.next() * n)
      if (!chosen.has(idx)) {
        chosen.add(idx)
        indices.push(idx)
      }
    }
    return indices.map((i) => X[i])
  }

  private buildTree(X: number[][], currentDepth: number, maxDepth: number): IsolationNode {
    const n = X.length
    if (currentDepth >= maxDepth || n <= 1) {
      return { size: n, isLeaf: true }
    }

    const d = X[0].length
    // Find features that have varying values
    const validFeatures: number[] = []
    const mins: number[] = []
    const maxs: number[] = []

    for (let j = 0; j < d; j++) {
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < n; i++) {
        const v = X[i][j]
        if (v < min) min = v
        if (v > max) max = v
      }
      if (max > min) {
        validFeatures.push(j)
        mins[j] = min
        maxs[j] = max
      }
    }

    if (validFeatures.length === 0) {
      return { size: n, isLeaf: true }
    }

    // Pick a random feature from valid ones
    const featIdx = validFeatures[Math.floor(this.random.next() * validFeatures.length)]
    const minVal = mins[featIdx]
    const maxVal = maxs[featIdx]

    // Split value uniformly between min and max
    const splitVal = minVal + this.random.next() * (maxVal - minVal)

    const left: number[][] = []
    const right: number[][] = []
    for (let i = 0; i < n; i++) {
      if (X[i][featIdx] < splitVal) {
        left.push(X[i])
      } else {
        right.push(X[i])
      }
    }

    return {
      size: n,
      isLeaf: false,
      splitFeature: featIdx,
      splitValue: splitVal,
      left: this.buildTree(left, currentDepth + 1, maxDepth),
      right: this.buildTree(right, currentDepth + 1, maxDepth),
    }
  }

  private pathLength(x: number[], node: IsolationNode, depth: number): number {
    if (node.isLeaf || !node.left || !node.right || node.splitFeature === undefined || node.splitValue === undefined) {
      return depth + c(node.size)
    }

    const v = x[node.splitFeature]
    if (Number.isNaN(v)) {
      return depth + c(node.size)
    }

    if (v < node.splitValue) {
      return this.pathLength(x, node.left, depth + 1)
    }
    return this.pathLength(x, node.right, depth + 1)
  }
}
