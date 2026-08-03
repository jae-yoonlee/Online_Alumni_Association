/**
 * 전국 학교 데이터 로더.
 * schools.json(850KB)은 번들에 넣지 않고 public/에 두고 fetch한다.
 * 번들에 넣으면 JS 모듈로 변환되며 크기가 1.5배로 커진다.
 */

const DATA_URL = `${import.meta.env.BASE_URL}data/schools.json`

let cache = null
let inflight = null

export const LEVEL_EMOJI = ['🏫', '🎒', '🎓']

function expand(data) {
  const list = data.rows.map(([id, name, level, sido, lat, lng, addr, branch]) => ({
    id,
    name,
    level, // 0 초 / 1 중 / 2 고
    levelName: data.levels[level],
    sido: data.sido[sido],
    lat,
    lng,
    addr,
    branch: branch === 1,
  }))

  return {
    meta: data.meta,
    levels: data.levels,
    sido: data.sido,
    list,
    byId: new Map(list.map((s) => [s.id, s])),
  }
}

export function loadSchools() {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`학교 데이터 요청 실패 (HTTP ${res.status})`)
      return res.json()
    })
    .then((json) => {
      cache = expand(json)
      inflight = null
      return cache
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

/** 이미 로드됐다면 동기적으로 학교를 조회 (지도 마커 클릭 등) */
export function getLoaded() {
  return cache
}

/**
 * 학교명 검색. 앞에서부터 일치하는 학교를 우선 노출한다.
 * @param {object} data loadSchools() 결과
 * @param {string} query 검색어
 * @param {{level?: number|null, sido?: string|null, limit?: number}} opts
 */
export function searchSchools(data, query, { level = null, sido = null, limit = 40 } = {}) {
  const q = query.trim().replace(/\s+/g, '')
  const starts = []
  const contains = []

  for (const s of data.list) {
    if (level !== null && s.level !== level) continue
    if (sido && s.sido !== sido) continue

    if (!q) {
      starts.push(s)
      if (starts.length >= limit) break
      continue
    }

    const name = s.name.replace(/\s+/g, '')
    if (name.startsWith(q)) starts.push(s)
    else if (name.includes(q)) contains.push(s)

    if (starts.length >= limit) break
  }

  return [...starts, ...contains].slice(0, limit)
}

/** 학교급·시도 필터를 적용한 전체 목록 (지도 마커용) */
export function filterSchools(data, { levels = [0, 1, 2], sido = null } = {}) {
  const set = new Set(levels)
  return data.list.filter((s) => set.has(s.level) && (!sido || s.sido === sido))
}

/** 졸업연도 선택지 — 올해부터 1945년까지 */
export function gradYearOptions() {
  const now = new Date().getFullYear()
  const years = []
  for (let y = now; y >= 1945; y--) years.push(y)
  return years
}
