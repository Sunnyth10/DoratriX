class MinPriorityQueue {
  constructor() {
    this.items = []
  }

  push(value, priority) {
    this.items.push({ value, priority })
    this.bubbleUp(this.items.length - 1)
  }

  pop() {
    if (this.items.length === 0) return null

    const smallest = this.items[0]
    const last = this.items.pop()

    if (this.items.length > 0) {
      this.items[0] = last
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
      if (this.items[parentIndex].priority <= this.items[index].priority) break

      ;[this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]]
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

      ;[this.items[index], this.items[smallestIndex]] = [
        this.items[smallestIndex],
        this.items[index],
      ]
      index = smallestIndex
    }
  }
}

export function dijkstra(graph, startNodeId, endNodeId) {
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
  queue.push(startNodeId, 0)

  while (true) {
    const current = queue.pop()
    if (!current) break
    if (current.priority !== distances.get(current.value)) continue

    visited.add(current.value)

    for (const neighbor of adjacency.get(current.value) ?? []) {
      if (visited.has(neighbor.nodeId)) continue

      const nextDistance = current.priority + neighbor.weight

      if (nextDistance < (distances.get(neighbor.nodeId) ?? Infinity)) {
        distances.set(neighbor.nodeId, nextDistance)
        previous.set(neighbor.nodeId, current.value)
        queue.push(neighbor.nodeId, nextDistance)
      }
    }

    frames.push({
      currentNode: current.value,
      frontier: [...new Set(queue.nodeIds().filter((nodeId) => !visited.has(nodeId)))],
      visited: [...visited],
    })

    if (current.value === endNodeId) break
  }

  const distance = distances.get(endNodeId)
  if (distance === undefined) return { path: [], distance: Infinity, frames }

  const path = []
  for (let nodeId = endNodeId; nodeId !== undefined; nodeId = previous.get(nodeId)) {
    path.unshift(nodeId)
  }

  return { path, distance, frames }
}
