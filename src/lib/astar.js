import { haversineDistance } from './graph.js'

class MinPriorityQueue {
  constructor() {
    this.items = []
    this.indices = new Map()
  }

  push(value, priority) {
    const existingIndex = this.indices.get(value)

    if (existingIndex !== undefined) {
      if (this.items[existingIndex].priority <= priority) return

      this.items[existingIndex].priority = priority
      this.bubbleUp(existingIndex)
      return
    }

    this.items.push({ value, priority })
    this.indices.set(value, this.items.length - 1)
    this.bubbleUp(this.items.length - 1)
  }

  pop() {
    if (this.items.length === 0) return null

    const smallest = this.items[0]
    const last = this.items.pop()
    this.indices.delete(smallest.value)

    if (this.items.length > 0) {
      this.items[0] = last
      this.indices.set(last.value, 0)
      this.bubbleDown(0)
    }

    return smallest
  }

  nodeIds() {
    return this.items.map((item) => item.value)
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.items[parentIndex].priority <= this.items[index].priority) return

      this.swap(parentIndex, index)
      index = parentIndex
    }
  }

  bubbleDown(index) {
    while (true) {
      const leftIndex = index * 2 + 1
      const rightIndex = leftIndex + 1
      let smallestIndex = index

      if (
        leftIndex < this.items.length &&
        this.items[leftIndex].priority < this.items[smallestIndex].priority
      ) {
        smallestIndex = leftIndex
      }
      if (
        rightIndex < this.items.length &&
        this.items[rightIndex].priority < this.items[smallestIndex].priority
      ) {
        smallestIndex = rightIndex
      }
      if (smallestIndex === index) return

      this.swap(index, smallestIndex)
      index = smallestIndex
    }
  }

  swap(firstIndex, secondIndex) {
    ;[this.items[firstIndex], this.items[secondIndex]] = [
      this.items[secondIndex],
      this.items[firstIndex],
    ]
    this.indices.set(this.items[firstIndex].value, firstIndex)
    this.indices.set(this.items[secondIndex].value, secondIndex)
  }
}

export function astar(graph, startNodeId, endNodeId, { frameDistance = 25 } = {}) {
  if (frameDistance <= 0) throw new Error('frameDistance must be greater than zero')

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const goal = nodesById.get(endNodeId)
  if (!nodesById.has(startNodeId) || !goal) return { path: [], distance: Infinity, frames: [] }

  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]))
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({ nodeId: edge.to, weight: edge.weight })
    adjacency.get(edge.to)?.push({ nodeId: edge.from, weight: edge.weight })
  }

  const distances = new Map([[startNodeId, 0]])
  const previous = new Map()
  const visited = new Set()
  const frames = []
  const queue = new MinPriorityQueue()
  let nodesInLayer = []
  let nextFrameDistance = frameDistance
  queue.push(startNodeId, haversineDistance(nodesById.get(startNodeId), goal))

  function recordFrame(currentNode) {
    if (nodesInLayer.length === 0) return

    frames.push({
      currentNode,
      frontier: queue.nodeIds(),
      visited: [...visited],
      newlyVisited: nodesInLayer,
    })
    nodesInLayer = []
  }

  while (true) {
    const current = queue.pop()
    if (!current) break

    const currentDistance = distances.get(current.value)
    visited.add(current.value)
    nodesInLayer.push(current.value)

    for (const neighbor of adjacency.get(current.value) ?? []) {
      if (visited.has(neighbor.nodeId)) continue

      const nextDistance = currentDistance + neighbor.weight
      if (nextDistance < (distances.get(neighbor.nodeId) ?? Infinity)) {
        distances.set(neighbor.nodeId, nextDistance)
        previous.set(neighbor.nodeId, current.value)
        const estimate = haversineDistance(nodesById.get(neighbor.nodeId), goal)
        queue.push(neighbor.nodeId, nextDistance + estimate)
      }
    }

    if (currentDistance >= nextFrameDistance) {
      recordFrame(current.value)
      nextFrameDistance = (Math.floor(currentDistance / frameDistance) + 1) * frameDistance
    }

    if (current.value === endNodeId) {
      recordFrame(current.value)
      break
    }
  }

  recordFrame([...visited].at(-1))

  const distance = distances.get(endNodeId)
  if (distance === undefined) return { path: [], distance: Infinity, frames }

  const path = []
  for (let nodeId = endNodeId; nodeId !== undefined; nodeId = previous.get(nodeId)) {
    path.unshift(nodeId)
  }

  return { path, distance, frames }
}
