import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isConfigured, supabase } from './lib/supabase'
import { LEVEL_EMOJI, filterSchools, loadSchools, searchSchools } from './lib/schools'
import MapView from './components/MapView'
import SchoolPanel from './components/SchoolPanel'
import AuthPanel from './components/AuthPanel'

const LEVEL_LABELS = ['초등학교', '중학교', '고등학교']

export default function App() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [session, setSession] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [selected, setSelected] = useState(null)
  const [focus, setFocus] = useState(null)
  const [showAuth, setShowAuth] = useState(false)

  const [query, setQuery] = useState('')
  const [levels, setLevels] = useState([0, 1, 2])
  const [sido, setSido] = useState('')
  const searchBoxRef = useRef(null)

  // ── 학교 데이터 로드 ──────────────────────────────────────
  useEffect(() => {
    loadSchools()
      .then(setData)
      .catch(() => setLoadError('학교 데이터를 불러오지 못했습니다. 새로고침해 주세요.'))
  }, [])

  // ── 세션 구독 ────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) return

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) setShowAuth(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── 내 동문 등록 목록 ────────────────────────────────────
  useEffect(() => {
    if (!session) {
      setMemberships([])
      return
    }
    let alive = true
    supabase
      .from('memberships')
      .select('*')
      .eq('user_id', session.user.id)
      .order('grad_year', { ascending: false })
      .then(({ data }) => {
        if (alive) setMemberships(data ?? [])
      })
    return () => {
      alive = false
    }
  }, [session])

  // ── 지도에 올릴 학교 (필터 적용) ─────────────────────────
  const visible = useMemo(() => {
    if (!data) return []
    return filterSchools(data, { levels, sido: sido || null })
  }, [data, levels, sido])

  // ── 검색 결과 ────────────────────────────────────────────
  const results = useMemo(() => {
    if (!data || !query.trim()) return []
    return searchSchools(data, query, {
      level: levels.length === 1 ? levels[0] : null,
      sido: sido || null,
      limit: 30,
    })
  }, [data, query, levels, sido])

  const openSchool = useCallback((school) => {
    setSelected(school)
    setFocus({ ...school, at: Date.now() })
    setQuery('')
    searchBoxRef.current?.blur()
  }, [])

  const myMembership = selected ? memberships.find((m) => m.school_id === selected.id) : null

  async function leaveSchool() {
    if (!myMembership || !confirm('동문 등록을 해제할까요? 기수방을 볼 수 없게 됩니다.')) return
    await supabase.from('memberships').delete().eq('id', myMembership.id)
    setMemberships((prev) => prev.filter((m) => m.id !== myMembership.id))
  }

  function toggleLevel(idx) {
    setLevels((prev) => (prev.includes(idx) ? prev.filter((v) => v !== idx) : [...prev, idx].sort()))
  }

  return (
    <div className="flex h-full flex-col bg-slate-100">
      {!isConfigured && (
        <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          ⚙️ Supabase 환경변수가 설정되지 않아 로그인·방명록이 비활성 상태입니다. 지도는 그대로 사용할 수 있어요.
          <span className="ml-1 opacity-70">(README의 설정 안내 참고)</span>
        </p>
      )}

      {/* ── 상단 바 ─────────────────────────────────────── */}
      <header className="z-[1000] shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <h1 className="shrink-0 text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
            🎓 온라인 동창회
          </h1>

          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <input
              ref={searchBoxRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={data ? '학교 이름 검색 (예: 화성고)' : '학교 데이터 불러오는 중…'}
              disabled={!data}
              className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pr-4 pl-10 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">🔍</span>

            {results.length > 0 && (
              <ul className="absolute top-full right-0 left-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                {results.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openSchool(s)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-indigo-50"
                    >
                      <span>{LEVEL_EMOJI[s.level]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{s.name}</span>
                        <span className="block truncate text-xs text-slate-400">{s.addr}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ml-auto shrink-0">
            {session ? (
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="rounded-full px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100"
              >
                로그아웃
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                disabled={!isConfigured}
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                로그인
              </button>
            )}
          </div>
        </div>

        {/* 필터 + 내 학교 */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-sm">
          {LEVEL_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleLevel(idx)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                levels.includes(idx)
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {LEVEL_EMOJI[idx]} {label}
            </button>
          ))}

          <select
            value={sido}
            onChange={(e) => setSido(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">전국</option>
            {data?.sido.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400">{visible.length.toLocaleString()}개교</span>

          {memberships.length > 0 && (
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">내 학교</span>
              {memberships.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const s = data?.byId.get(m.school_id)
                    if (s) openSchool(s)
                  }}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-indigo-100 hover:text-indigo-700"
                >
                  {m.school_name} {String(m.grad_year).slice(2)}
                </button>
              ))}
            </span>
          )}
        </div>
      </header>

      {/* ── 본문 ────────────────────────────────────────── */}
      <main className="relative flex min-h-0 flex-1 flex-col sm:flex-row">
        {selected && (
          <div className="absolute inset-0 z-[1100] sm:relative sm:inset-auto sm:z-auto sm:h-full">
            <SchoolPanel
              school={selected}
              session={session}
              membership={myMembership}
              onJoined={(m) => setMemberships((prev) => [...prev, m])}
              onLeft={leaveSchool}
              onRequireAuth={() => setShowAuth(true)}
              onClose={() => setSelected(null)}
            />
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {loadError ? (
            <p className="grid h-full place-items-center px-6 text-center text-sm text-rose-600">{loadError}</p>
          ) : !data ? (
            <p className="grid h-full place-items-center text-sm text-slate-400">전국 학교 지도를 준비하는 중…</p>
          ) : (
            <MapView schools={visible} selectedId={selected?.id} onSelect={setSelected} focus={focus} />
          )}
        </div>
      </main>

      {/* ── 하단 출처 ───────────────────────────────────── */}
      <footer className="z-[1000] shrink-0 border-t border-slate-200 bg-white px-4 py-1.5 text-center text-[11px] text-slate-400">
        학교 정보 출처:{' '}
        <a
          href="https://www.data.go.kr/data/15021148/standard.do"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-indigo-600"
        >
          공공데이터포털 전국초중등학교위치표준데이터
        </a>
        {data?.meta.referenceDate && ` (기준일 ${data.meta.referenceDate})`} · 지도 © OpenStreetMap 기여자
      </footer>

      {showAuth && <AuthPanel onClose={() => setShowAuth(false)} />}
    </div>
  )
}
