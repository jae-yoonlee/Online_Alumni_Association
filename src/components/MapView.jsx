import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { LEVEL_EMOJI } from '../lib/schools'

const KOREA_CENTER = [36.5, 127.9]
const KOREA_BOUNDS = L.latLngBounds([32.5, 123.5], [39.6, 132.5])

function pinIcon(level, active) {
  return L.divIcon({
    className: '',
    html: `<div class="school-pin" data-level="${level}" data-active="${active}">${LEVEL_EMOJI[level]}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

/**
 * 전국 학교 지도. react-leaflet 없이 Leaflet을 직접 다룬다.
 * (마커 12,000개를 다루므로 React 렌더 트리 밖에서 관리하는 편이 훨씬 가볍다)
 */
export default function MapView({ schools, selectedId, onSelect, focus }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const markersRef = useRef(new Map())
  const prevSelectedRef = useRef(null)
  const onSelectRef = useRef(onSelect)

  // 콜백은 ref로 넘겨 마커를 다시 만들지 않도록 한다
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 지도 1회 초기화
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: KOREA_CENTER,
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: KOREA_BOUNDS,
      maxBoundsViscosity: 0.7,
      zoomControl: false,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    })
    map.addLayer(cluster)

    mapRef.current = map
    clusterRef.current = cluster

    const markers = markersRef.current
    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markers.clear()
    }
  }, [])

  // 학교 목록이 바뀌면 마커를 다시 구성
  useEffect(() => {
    const cluster = clusterRef.current
    if (!cluster) return

    cluster.clearLayers()
    markersRef.current.clear()

    const markers = schools.map((s) => {
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(s.level, false),
        title: s.name,
        keyboard: false,
      })
      marker.on('click', () => onSelectRef.current?.(s))
      markersRef.current.set(s.id, { marker, level: s.level })
      return marker
    })

    cluster.addLayers(markers)
  }, [schools])

  // 선택된 학교 강조 — 12,000개를 모두 훑지 않고 바뀐 것만 갱신한다
  useEffect(() => {
    const prev = prevSelectedRef.current
    if (prev && prev !== selectedId) {
      const entry = markersRef.current.get(prev)
      if (entry) entry.marker.setIcon(pinIcon(entry.level, false))
    }

    const current = selectedId ? markersRef.current.get(selectedId) : null
    if (current) current.marker.setIcon(pinIcon(current.level, true))

    prevSelectedRef.current = selectedId
  }, [selectedId, schools])

  // 검색 결과 등으로 특정 학교로 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return

    const entry = markersRef.current.get(focus.id)
    if (entry) {
      // 클러스터에 묶여 있으면 풀어서 해당 마커가 보이는 지점까지 이동
      clusterRef.current.zoomToShowLayer(entry.marker, () => {})
    } else {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
    }
  }, [focus])

  return <div ref={containerRef} className="h-full w-full" aria-label="전국 학교 지도" />
}
