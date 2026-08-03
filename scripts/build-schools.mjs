/**
 * data/schools_raw.csv (공공데이터포털 전국초중등학교위치표준데이터)를
 * 앱이 바로 쓰는 압축 JSON(public/data/schools.json)으로 변환한다.
 *
 * public/에 두는 이유: 번들에 넣으면 JS 모듈로 변환되면서 크기가 1.5배 커진다.
 * 정적 JSON으로 두면 fetch + JSON.parse가 더 작고 빠르다.
 *
 * 원본: https://www.data.go.kr/data/15021148/standard.do
 * 실행: npm run build:schools
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// 시도교육청명 → 짧은 시도명 (필터 UI용)
const SIDO = {
  서울특별시교육청: '서울',
  부산광역시교육청: '부산',
  대구광역시교육청: '대구',
  인천광역시교육청: '인천',
  광주광역시교육청: '광주',
  대전광역시교육청: '대전',
  울산광역시교육청: '울산',
  세종특별자치시교육청: '세종',
  경기도교육청: '경기',
  강원특별자치도교육청: '강원',
  충청북도교육청: '충북',
  충청남도교육청: '충남',
  전북특별자치도교육청: '전북',
  전라남도교육청: '전남',
  경상북도교육청: '경북',
  경상남도교육청: '경남',
  제주특별자치도교육청: '제주',
}

const LEVELS = ['초등학교', '중학교', '고등학교']
const SIDO_LIST = Object.values(SIDO)

/** 따옴표를 처리하는 최소 CSV 파서 */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const raw = readFileSync(join(root, 'data/schools_raw.csv'), 'utf8').replace(/^﻿/, '')
const [header, ...body] = parseCsv(raw)
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))

const required = ['학교ID', '학교명', '학교급구분', '운영상태', '시도교육청명', '위도', '경도']
for (const r of required) {
  if (col[r] === undefined) throw new Error(`원본 CSV에 '${r}' 컬럼이 없습니다. 데이터 형식이 바뀌었는지 확인하세요.`)
}

const skipped = { 미운영: 0, 좌표없음: 0, 분류불가: 0 }
const rows = []

for (const r of body) {
  if (r.length < header.length) continue

  if (r[col['운영상태']].trim() !== '운영') {
    skipped.미운영++
    continue
  }

  const lat = Number(r[col['위도']])
  const lng = Number(r[col['경도']])
  // 대한민국 영역을 크게 벗어나는 좌표는 오류로 간주하고 버린다
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    skipped.좌표없음++
    continue
  }

  const levelIdx = LEVELS.indexOf(r[col['학교급구분']].trim())
  const sidoIdx = SIDO_LIST.indexOf(SIDO[r[col['시도교육청명']].trim()])
  if (levelIdx < 0 || sidoIdx < 0) {
    skipped.분류불가++
    continue
  }

  const addr = (r[col['소재지도로명주소']] || r[col['소재지지번주소']] || '').trim()
  const branch = (r[col['본교분교구분']] || '').trim() === '분교'

  rows.push([
    r[col['학교ID']].trim(),
    r[col['학교명']].trim(),
    levelIdx,
    sidoIdx,
    Math.round(lat * 1e5) / 1e5,
    Math.round(lng * 1e5) / 1e5,
    addr,
    branch ? 1 : 0,
  ])
}

// 학교명 기준 정렬 — 목록 UI에서 그대로 쓸 수 있도록
rows.sort((a, b) => a[1].localeCompare(b[1], 'ko'))

const out = {
  meta: {
    source: '공공데이터포털 전국초중등학교위치표준데이터 (한국교육시설안전원)',
    url: 'https://www.data.go.kr/data/15021148/standard.do',
    referenceDate: body[0]?.[col['데이터기준일자']]?.trim() ?? '',
    count: rows.length,
  },
  levels: LEVELS,
  sido: SIDO_LIST,
  // [학교ID, 학교명, 학교급idx, 시도idx, 위도, 경도, 주소, 분교여부]
  rows,
}

mkdirSync(join(root, 'public/data'), { recursive: true })
writeFileSync(join(root, 'public/data/schools.json'), JSON.stringify(out))

const kb = (n) => `${(n / 1024).toFixed(0)}KB`
console.log(`✅ ${rows.length.toLocaleString()}개교 → public/data/schools.json (${kb(JSON.stringify(out).length)})`)
console.log(`   기준일자: ${out.meta.referenceDate}`)
console.log(`   제외: 미운영 ${skipped.미운영} / 좌표이상 ${skipped.좌표없음} / 분류불가 ${skipped.분류불가}`)
