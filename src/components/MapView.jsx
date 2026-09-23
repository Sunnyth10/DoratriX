import { useEffect, useMemo, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { astar } from '../lib/astar'
import { dijkstra } from '../lib/dijkstra'
import {
  checkShortReachability,
  fetchRoadGraph,
  findNearestNode,
  findNearestRoadNode,
  isLocationInGraphBounds,
  logNearestGraphNode,
  MAX_SNAP_METERS,
} from '../lib/graph'
import { useSearchAnimation } from '../hooks/useSearchAnimation'

// Replace these with the latitude and longitude of your city.
const cityCenter = [17.418, 78.489]
const roadNetworkHalfSideKilometers = 0.75
const emptyFrames = []
const networkPathOptions = {
  color: '#3158b4',
  opacity: 0.68,
  weight: 1.4,
  interactive: false,
}

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

function MapZoomHandler({ onZoomChange }) {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom())
    },
  })

  return null
}

function MapPlaybackZoomHandler({ playRequest }) {
  const map = useMap()

  useEffect(() => {
    if (playRequest === 0 || map.getZoom() >= 13) return

    map.setZoom(15)
  }, [map, playRequest])

  return null
}

function MapFocus({ request }) {
  const map = useMap()

  useEffect(() => {
    if (!request) return

    map.flyTo(request.center, 15)
  }, [map, request])

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
  const [graphStatus, setGraphStatus] = useState('loading')
  const [graphError, setGraphError] = useState(null)
  const [graphRequest, setGraphRequest] = useState({ center: cityCenter, label: 'your area', key: 0 })
  const [isRoadLoading, setIsRoadLoading] = useState(true)
  const [locationQuery, setLocationQuery] = useState('')
  const [isLocationSearching, setIsLocationSearching] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [mapFocusRequest, setMapFocusRequest] = useState(null)
  const [searchRun, setSearchRun] = useState(0)
  const [playRequest, setPlayRequest] = useState(0)
  const [mapZoom, setMapZoom] = useState(13)
  const [outsideClick, setOutsideClick] = useState(null)
  const [snapMessage, setSnapMessage] = useState(null)
  const activeRoute = comparison?.[activeAlgorithm]?.result ?? route
  const frames = activeRoute?.frames ?? emptyFrames
  const { currentFrameIndex, isPlaying, play, pause, reset, setFrameIndex } =
    useSearchAnimation(frames, searchRun)
  const graphRef = useRef(graph)

  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') setOutsideClick(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    setIsRoadLoading(true)

    queueMicrotask(async () => {
      if (controller.signal.aborted) return

      try {
        const newGraph = await fetchRoadGraph(graphRequest.center, {
          signal: controller.signal,
          halfSideKilometers: roadNetworkHalfSideKilometers,
        })
        if (!newGraph.nodes.length || !newGraph.edges.length) {
          throw new Error('No usable roads were returned for this area.')
        }

        setGraph(newGraph)
        setStartNodeId(null)
        setEndNodeId(null)
        setRoute(null)
        setComparison(null)
        setDebugNodeIds([])
        setSearchRun((run) => run + 1)
        setMapFocusRequest({ center: graphRequest.center, key: graphRequest.key })
        setGraphStatus('ready')
        setGraphError(null)
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Could not load road graph:', error)
          const hasPreviousGraph = Boolean(graphRef.current)
          setGraphStatus(hasPreviousGraph ? 'ready' : 'error')
          setGraphError(
            hasPreviousGraph
              ? `Couldn't load roads near ${graphRequest.label}. Your previous map is still active.`
              : 'Road data could not be loaded.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setOutsideClick(null)
          setIsRoadLoading(false)
        }
      }
    })

    return () => controller.abort()
  }, [graphRequest])

  const nodesById = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.id, node])), [graph])
  const networkSegments = useMemo(
    () =>
      (graph?.edges ?? []).flatMap((edge) => {
        const from = nodesById.get(edge.from)
        const to = nodesById.get(edge.to)
        return from && to ? [[[from.lat, from.lng], [to.lat, to.lng]]] : []
      }),
    [graph, nodesById],
  )
  const startNode = nodesById.get(startNodeId)
  const endNode = nodesById.get(endNodeId)
  const routePositions = (activeRoute?.path ?? [])
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean)
    .map((node) => [node.lat, node.lng])
  const currentFrame = frames[currentFrameIndex]
  const showFinalPath =
    routePositions.length > 1 && frames.length > 0 && currentFrameIndex === frames.length - 1 && !isPlaying
  const showSearchProgress = currentFrame && !showFinalPath
  const searchMarkerRadius = Math.min(5, Math.max(2, 2 + (mapZoom - 13) * 0.75))
  const currentMarkerRadius = Math.min(7, searchMarkerRadius + 2)

  function handlePlay() {
    setPlayRequest((request) => request + 1)
    play()
  }

  function requestRoadGraph(center, label) {
    if (isRoadLoading) return

    setOutsideClick(null)
    setIsRoadLoading(true)
    setGraphError(null)
    setGraphRequest((request) => ({ center, label, key: request.key + 1 }))
  }

  async function handleLocationSearch(event) {
    event.preventDefault()
    const query = locationQuery.trim()
    if (!query || isRoadLoading || isLocationSearching) return

    setIsLocationSearching(true)
    setLocationError(null)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      )
      if (!response.ok) throw new Error('Location search failed')

      const results = await response.json()
      const result = results[0]
      if (!result) {
        setLocationError('No matching location was found.')
        return
      }

      const center = [Number(result.lat), Number(result.lon)]
      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
        setLocationError('No matching location was found.')
        return
      }

      if (isLocationInGraphBounds(graph, { lat: center[0], lng: center[1] })) {
        setMapFocusRequest((request) => ({ center, key: (request?.key ?? 0) + 1 }))
      } else {
        requestRoadGraph(center, result.display_name || query)
      }
    } catch (error) {
      setLocationError('Location search failed. Please try again.')
    } finally {
      setIsLocationSearching(false)
    }
  }

  function handleMapClick({ lat, lng }) {
    if (isRoadLoading || isLocationSearching) return

    setOutsideClick(null)

    if (!isLocationInGraphBounds(graph, { lat, lng })) {
      setOutsideClick({ lat, lng })
      return
    }

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

    const nearestRoad = findNearestRoadNode(graph, lat, lng)
    if (!nearestRoad) return
    if (nearestRoad.distance > MAX_SNAP_METERS) {
      setSnapMessage('Too far from a road. Click closer to a highlighted street.')
      return
    }
    const { node } = nearestRoad

    setSnapMessage(null)
    setRoute(null)
    setComparison(null)

    if (!startNodeId) {
      setStartNodeId(node.id)
    } else if (!endNodeId) {
      setEndNodeId(node.id)
    }
  }

  function handleMarkerDrag(nodeType, event) {
    if (isRoadLoading || isLocationSearching) return

    const { lat, lng } = event.target.getLatLng()
    const nearestRoad = findNearestRoadNode(graph, lat, lng)
    if (!nearestRoad || nearestRoad.distance > MAX_SNAP_METERS) return
    const { node: nearestNode } = nearestRoad

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
    setComparison(null)
    setRoute(result)
    setSearchRun((run) => run + 1)
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
    setSearchRun((run) => run + 1)
  }

  function exploredNodeCount(result) {
    return result.frames.at(-1)?.visited.length ?? 0
  }

  return (
    <div className="map-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none"><rect x="7" y="7" width="26" height="26" rx="4" transform="rotate(45 20 20)" fill="#2952e3"/><path d="M12.5 13.5h7v8h8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="m24 17 3.5 4.5L24 26" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="brand-name">DoratriX</span>
        <span className="brand-tagline">Find Shortest Paths. Visualize the Journey.</span>
      </header>
      <div className="map-controls">
        <button
          className="reset-button"
          type="button"
          disabled={isRoadLoading}
          onClick={() => {
          setStartNodeId(null)
          setEndNodeId(null)
          setRoute(null)
          setComparison(null)
        }}
      >
          <span className="control-row-leading">
            <svg className="control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-5.05 6-11a6 6 0 1 0-12 0c0 5.95 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>
            <span>Clear Points</span>
          </span>
          <svg className="row-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
        </button>
        <p className="graph-status" role="status">
          {graphError ||
            snapMessage ||
            (graphStatus === 'ready' && !activeRoute && 'Click a start point, then an end point.') ||
            (isPlaying && `Searching ${activeAlgorithm === 'astar' ? 'with A*' : 'with Dijkstra'}…`) ||
            (showFinalPath && 'Shortest path found.') ||
            (activeRoute && 'No route exists between these points.')}
        </p>
        {graphError && (
          <button className="dismiss-error-button" type="button" onClick={() => setGraphError(null)}>
            Dismiss
          </button>
        )}
        {graphStatus === 'error' && !isRoadLoading && (
          <button
            className="retry-button"
            type="button"
            onClick={() => requestRoadGraph(graphRequest.center, graphRequest.label)}
          >
            Retry road data
          </button>
        )}
        <form className="location-search" onSubmit={handleLocationSearch}>
          <label htmlFor="location-search">Find a location</label>
          <div>
            <input
              id="location-search"
              type="search"
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="Search a place"
              disabled={isRoadLoading}
            />
            <button type="submit" disabled={isRoadLoading || isLocationSearching || !locationQuery.trim()}>
              {isLocationSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {locationError && <span role="alert">{locationError}</span>}
        </form>
        <button
          className="debug-button"
          type="button"
          aria-pressed={debugMode}
          disabled={isRoadLoading}
          onClick={() => {
            setDebugMode((enabled) => !enabled)
            setDebugNodeIds([])
          }}
        >
          <span className="control-row-leading">
            <svg className="control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 9h6M10 5.5 8.5 3M14 5.5 15.5 3M7.5 14.5h9M8 20l1.25-3.25h5.5L16 20M7 9.5h10v5a5 5 0 0 1-10 0v-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="12" r=".8" fill="currentColor"/><circle cx="14" cy="12" r=".8" fill="currentColor"/></svg>
            <span>Debug Mode: {debugMode ? 'On' : 'Off'}</span>
          </span>
          <span className={`toggle-switch ${debugMode ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
        <button
          className="path-button"
          type="button"
          disabled={isRoadLoading || !startNodeId || !endNodeId}
          onClick={findShortestPath}
      >
          <span className="control-row-leading">
            <svg className="control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="17" r="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7.7 15.9C10.2 12.5 10.7 8 16.1 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="2.5 2.5"/></svg>
            <span>Find Shortest Path</span>
          </span>
          <span className="row-chevron" aria-hidden="true">›</span>
        </button>
        <button
          className="compare-button"
          type="button"
          disabled={isRoadLoading || !startNodeId || !endNodeId}
          onClick={compareAlgorithms}
      >
          <span className="control-row-leading">
            <svg className="control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M5 7h14M7 7l-3 6h6L7 7Zm10 0-3 6h6l-3-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 20h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            <span>Compare Algorithms</span>
          </span>
          <span className="row-chevron" aria-hidden="true">›</span>
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
                onClick={() => {
                  setActiveAlgorithm('dijkstra')
                  setSearchRun((run) => run + 1)
                }}
              >
                Dijkstra
              </button>
              <button
                type="button"
                aria-pressed={activeAlgorithm === 'astar'}
                onClick={() => {
                  setActiveAlgorithm('astar')
                  setSearchRun((run) => run + 1)
                }}
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
              <button type="button" onClick={handlePlay} disabled={isPlaying}>
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
      <MapContainer center={cityCenter} zoom={13} className="map" preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler graph={graph} onMapClick={handleMapClick} />
        <MapZoomHandler onZoomChange={setMapZoom} />
        <MapPlaybackZoomHandler playRequest={playRequest} />
        <MapFocus request={mapFocusRequest} />
        {graph?.bounds && (
          <Rectangle
            bounds={[[graph.bounds.south, graph.bounds.west], [graph.bounds.north, graph.bounds.east]]}
            pathOptions={{ color: '#3158b4', dashArray: '6 6', opacity: 0.35, fill: false, interactive: false, weight: 1 }}
            interactive={false}
          />
        )}
        {networkSegments.length > 0 && <Polyline positions={networkSegments} pathOptions={networkPathOptions} />}
        {showSearchProgress && currentFrame.visited.map((nodeId) => {
          const node = nodesById.get(nodeId)
          return node && <CircleMarker key={`visited-${nodeId}`} center={[node.lat, node.lng]} radius={searchMarkerRadius} pathOptions={{ color: '#6b7280', fillColor: '#6b7280', fillOpacity: 0.8, weight: 1 }} />
        })}
        {showSearchProgress && currentFrame.frontier.map((nodeId) => {
          const node = nodesById.get(nodeId)
          return node && <CircleMarker key={`frontier-${nodeId}`} center={[node.lat, node.lng]} radius={searchMarkerRadius} pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.9, weight: 1 }} />
        })}
        {showSearchProgress && nodesById.get(currentFrame.currentNode) && (
          <CircleMarker
            key="current-node"
            center={[
              nodesById.get(currentFrame.currentNode).lat,
              nodesById.get(currentFrame.currentNode).lng,
            ]}
            radius={currentMarkerRadius}
            pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1, weight: 1 }}
          />
        )}
        {showFinalPath && (
          <>
            <Polyline positions={routePositions} pathOptions={{ color: '#ffffff', opacity: 0.95, weight: 10, interactive: false }} />
            <Polyline positions={routePositions} pathOptions={{ color: '#0057ff', opacity: 1, weight: 6, interactive: false }} />
          </>
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
        {outsideClick && (
          <Popup
            position={[outsideClick.lat, outsideClick.lng]}
            eventHandlers={{ remove: () => setOutsideClick(null) }}
          >
            <p>No road data here.</p>
            {(startNodeId || endNodeId) && <p>This will clear your current points.</p>}
            <button type="button" onClick={() => requestRoadGraph([outsideClick.lat, outsideClick.lng], 'the selected location')}>
              Load roads near here
            </button>
          </Popup>
        )}
      </MapContainer>
      {isRoadLoading && (
        <div className="road-loading-overlay" role="status" aria-live="polite">
          <span className="road-loading-spinner" aria-hidden="true" />
          Loading roads near {graphRequest.label}…
        </div>
      )}
      <div className="map-legend" aria-label="Map legend">
        <span className="legend-item">
          <i className="legend-icon legend-route" aria-hidden="true" />
          Selected Path
        </span>
        <span className="legend-item">
          <i className="legend-icon legend-network" aria-hidden="true" />
          Network Points
        </span>
        <span className="legend-item">
          <i className="legend-icon legend-start" aria-hidden="true" />
          Start
        </span>
        <span className="legend-item">
          <i className="legend-icon legend-end" aria-hidden="true" />
          End
        </span>
      </div>
    </div>
  )
}
