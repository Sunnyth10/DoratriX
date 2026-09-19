import { useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { astar } from '../lib/astar'
import { dijkstra } from '../lib/dijkstra'
import {
  checkShortReachability,
  fetchRoadGraph,
  findNearestNode,
  findNearestRoadNode,
  logNearestGraphNode,
} from '../lib/graph'
import { useSearchAnimation } from '../hooks/useSearchAnimation'

// Replace these with the latitude and longitude of your city.
const cityCenter = [17.418, 78.489]
const emptyFrames = []

const markerIcon = (color) =>
  divIcon({
    className: 'snapped-marker-container',
    html: `<span class="snapped-marker" style="background: ${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

const startIcon = markerIcon('#16a34a')
const endIcon = markerIcon('#dc2626')

function MapClickHandler({ graph, onMapClick }) {
  useMapEvents({
    click(event) {
      if (!graph) return

      onMapClick(event.latlng)
    },
  })

  return null
}

export default function MapView() {
  const [graph, setGraph] = useState(null)
  const [startNodeId, setStartNodeId] = useState(null)
  const [endNodeId, setEndNodeId] = useState(null)
  const [route, setRoute] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [activeAlgorithm, setActiveAlgorithm] = useState('dijkstra')
  const [debugMode, setDebugMode] = useState(false)
  const [debugNodeIds, setDebugNodeIds] = useState([])
  const activeRoute = comparison?.[activeAlgorithm]?.result ?? route
  const frames = activeRoute?.frames ?? emptyFrames
  const { currentFrameIndex, isPlaying, play, pause, reset, setFrameIndex } =
    useSearchAnimation(frames)

  useEffect(() => {
    const controller = new AbortController()

    fetchRoadGraph(cityCenter, { signal: controller.signal })
      .then((roadGraph) => {
        console.log('Road graph:', roadGraph)
        setGraph(roadGraph)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Could not load road graph:', error)
        }
      })

    return () => controller.abort()
  }, [])

  const nodesById = new Map(graph?.nodes.map((node) => [node.id, node]))
  const startNode = nodesById.get(startNodeId)
  const endNode = nodesById.get(endNodeId)
  const routePositions = activeRoute?.path
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean)
    .map((node) => [node.lat, node.lng])
  const currentFrame = frames[currentFrameIndex]
  const showFinalPath =
    routePositions?.length > 1 && frames.length > 0 && currentFrameIndex === frames.length - 1

  function handleMapClick({ lat, lng }) {
    if (debugMode) {
      const { node } = logNearestGraphNode(graph, lat, lng)

      if (debugNodeIds.length === 1) {
        checkShortReachability(graph, debugNodeIds[0], node.id)
        setDebugNodeIds([debugNodeIds[0], node.id])
      } else {
        setDebugNodeIds([node.id])
      }
      return
    }

    const node = findNearestRoadNode(graph, lat, lng)
    if (!node) return

    setRoute(null)
    setComparison(null)

    if (!startNodeId) {
      setStartNodeId(node.id)
    } else if (!endNodeId) {
      setEndNodeId(node.id)
    }
  }

  function handleMarkerDrag(nodeType, event) {
    const { lat, lng } = event.target.getLatLng()
    const nearestNode = findNearestRoadNode(graph, lat, lng)

    setRoute(null)
    setComparison(null)

    if (nodeType === 'start') {
      setStartNodeId(nearestNode.id)
    } else {
      setEndNodeId(nearestNode.id)
    }
  }

  function findShortestPath() {
    const result = dijkstra(graph, startNodeId, endNodeId)
    console.log(result.frames.length)
    setComparison(null)
    setRoute(result)
  }

  function compareAlgorithms() {
    const dijkstraStart = performance.now()
    const dijkstraResult = dijkstra(graph, startNodeId, endNodeId)
    const dijkstraTime = performance.now() - dijkstraStart
    const astarStart = performance.now()
    const astarResult = astar(graph, startNodeId, endNodeId)
    const astarTime = performance.now() - astarStart

    setRoute(null)
    setActiveAlgorithm('dijkstra')
    setComparison({
      dijkstra: { result: dijkstraResult, time: dijkstraTime },
      astar: { result: astarResult, time: astarTime },
    })
  }

  function exploredNodeCount(result) {
    return result.frames.at(-1)?.visited.length ?? 0
  }

  return (
    <div className="map-shell">
      <div className="map-controls">
        <button
          className="reset-button"
          type="button"
          onClick={() => {
          setStartNodeId(null)
          setEndNodeId(null)
          setRoute(null)
          setComparison(null)
        }}
      >
          Clear Points
        </button>
        <button
          className="debug-button"
          type="button"
          aria-pressed={debugMode}
          onClick={() => {
            setDebugMode((enabled) => !enabled)
            setDebugNodeIds([])
          }}
        >
          Debug Mode: {debugMode ? 'On' : 'Off'}
        </button>
        <button
          className="path-button"
          type="button"
          disabled={!startNodeId || !endNodeId}
          onClick={findShortestPath}
        >
          Find Shortest Path
        </button>
        <button
          className="compare-button"
          type="button"
          disabled={!startNodeId || !endNodeId}
          onClick={compareAlgorithms}
        >
          Compare Algorithms
        </button>
        {activeRoute && Number.isFinite(activeRoute.distance) && (
          <span className="distance-label">Distance: {(activeRoute.distance / 1000).toFixed(2)} km</span>
        )}
        {comparison && (
          <div className="comparison-panel">
            <div className="algorithm-switcher">
              <button
                type="button"
                aria-pressed={activeAlgorithm === 'dijkstra'}
                onClick={() => setActiveAlgorithm('dijkstra')}
              >
                Dijkstra
              </button>
              <button
                type="button"
                aria-pressed={activeAlgorithm === 'astar'}
                onClick={() => setActiveAlgorithm('astar')}
              >
                A*
              </button>
            </div>
            <div className="algorithm-stats">
              {Object.entries(comparison).map(([algorithm, { result, time }]) => (
                <section key={algorithm}>
                  <h3>{algorithm === 'astar' ? 'A*' : 'Dijkstra'}</h3>
                  <span>Explored: {exploredNodeCount(result)}</span>
                  <span>Time: {time.toFixed(2)} ms</span>
                  <span>
                    Distance:{' '}
                    {Number.isFinite(result.distance) ? `${(result.distance / 1000).toFixed(2)} km` : 'No route'}
                  </span>
                </section>
              ))}
            </div>
          </div>
        )}
        {frames.length > 0 && (
          <div className="animation-controls">
            <div className="animation-buttons">
              <button type="button" onClick={play} disabled={isPlaying}>
                Play
              </button>
              <button type="button" onClick={pause} disabled={!isPlaying}>
                Pause
              </button>
              <button type="button" onClick={reset}>
                Reset
              </button>
            </div>
            <label>
              Step {currentFrameIndex + 1} / {frames.length}
              <input
                type="range"
                min="0"
                max={frames.length - 1}
                value={currentFrameIndex}
                onChange={(event) => setFrameIndex(event.target.value)}
              />
            </label>
          </div>
        )}
      </div>
      <MapContainer center={cityCenter} zoom={15} className="map" preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler graph={graph} onMapClick={handleMapClick} />
        {graph?.edges.map((edge) => {
          const from = nodesById.get(edge.from)
          const to = nodesById.get(edge.to)

          return (
            <Polyline
              key={edge.id}
              positions={[[from.lat, from.lng], [to.lat, to.lng]]}
              pathOptions={{ color: 'blue', weight: 1 }}
            />
          )
        })}
        {currentFrame?.visited.map((nodeId) => {
          const node = nodesById.get(nodeId)
          return node && <CircleMarker key={`visited-${nodeId}`} center={[node.lat, node.lng]} radius={3} pathOptions={{ color: '#6b7280', fillColor: '#6b7280', fillOpacity: 0.8, weight: 1 }} />
        })}
        {currentFrame?.frontier.map((nodeId) => {
          const node = nodesById.get(nodeId)
          return node && <CircleMarker key={`frontier-${nodeId}`} center={[node.lat, node.lng]} radius={3} pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.9, weight: 1 }} />
        })}
        {currentFrame && nodesById.get(currentFrame.currentNode) && (
          <CircleMarker
            key="current-node"
            center={[
              nodesById.get(currentFrame.currentNode).lat,
              nodesById.get(currentFrame.currentNode).lng,
            ]}
            radius={6}
            pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1, weight: 1 }}
          />
        )}
        {showFinalPath && (
          <Polyline positions={routePositions} pathOptions={{ color: '#0057ff', weight: 5 }} />
        )}
        {debugNodeIds.map((nodeId, index) => {
          const node = nodesById.get(nodeId)
          return (
            node && (
              <CircleMarker
                key={`debug-${nodeId}`}
                center={[node.lat, node.lng]}
                radius={7}
                pathOptions={{
                  color: index === 0 ? '#7c3aed' : '#ec4899',
                  fillColor: index === 0 ? '#7c3aed' : '#ec4899',
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            )
          )
        })}
        {startNode && (
          <Marker
            draggable
            eventHandlers={{ dragend: (event) => handleMarkerDrag('start', event) }}
            icon={startIcon}
            position={[startNode.lat, startNode.lng]}
          />
        )}
        {endNode && (
          <Marker
            draggable
            eventHandlers={{ dragend: (event) => handleMarkerDrag('end', event) }}
            icon={endIcon}
            position={[endNode.lat, endNode.lng]}
          />
        )}
      </MapContainer>
    </div>
  )
}
