import { useEffect, useState } from 'react'
import { isConfigured, supabase, toKoreanError } from '../lib/supabase'
import { LEVEL_EMOJI, gradYearOptions } from '../lib/schools'
import Guestbook from './Guestbook'

export default function SchoolPanel({ school, session, membership, onJoined, onLeft, onRequireAuth, onClose }) {
  const [tab, setTab] = useState('all')
  const [showJoin, setShowJoin] = useState(false)

  // 학교가 바뀌면 탭 상태를 초기화
  useEffect(() => {
    setTab('all')
    setShowJoin(false)
  }, [school.id])

  const signedIn = Boolean(session)

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white sm:w-[26rem] sm:border-r sm:border-slate-200">
      {/* 헤더 */}
      <header className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{LEVEL_EMOJI[school.level]}</span>
              <h2 className="truncate text-lg font-bold text-slate-900">{school.name}</h2>
              {school.branch && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">분교</span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-slate-500" title={school.addr}>
              {school.addr}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {membership ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-sm text-indigo-900">
              <b>{membership.grad_year}년 졸업</b> · {membership.nickname}
            </p>
            <button
              type="button"
              onClick={onLeft}
              className="text-xs text-indigo-400 transition hover:text-rose-500"
            >
              등록 해제
            </button>
          </div>
        ) : signedIn ? (
          showJoin ? (
            <JoinForm
              school={school}
              userId={session.user.id}
              defaultNickname={session.user.user_metadata?.display_name ?? ''}
              onCancel={() => setShowJoin(false)}
              onDone={(m) => {
                setShowJoin(false)
                onJoined(m)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowJoin(true)}
              className="mt-3 w-full rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              🎓 이 학교 동문으로 등록하기
            </button>
          )
        ) : isConfigured ? (
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-3 w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            로그인하고 참여하기
          </button>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Supabase가 연결되지 않아 방명록 기능이 꺼져 있습니다.
          </p>
        )}
      </header>

      {/* 탭 */}
      <nav className="flex shrink-0 gap-1 border-b border-slate-100 px-3 pt-2">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          전체 방명록
        </TabButton>
        <TabButton active={tab === 'cohort'} onClick={() => setTab('cohort')}>
          {membership ? `${membership.grad_year}년 기수방` : '기수방'}
          {!membership && <span className="ml-1 text-slate-300">🔒</span>}
        </TabButton>
      </nav>

      {/* 본문 */}
      {!signedIn ? (
        <p className="flex-1 px-6 py-12 text-center text-sm text-slate-400">
          로그인하면 이 학교의 방명록을 읽고 남길 수 있습니다.
        </p>
      ) : tab === 'all' ? (
        <Guestbook
          key={`all-${school.id}`}
          schoolId={school.id}
          gradYear={null}
          userId={session.user.id}
          nickname={membership?.nickname ?? session.user.user_metadata?.display_name ?? '동문'}
          canPost
        />
      ) : membership ? (
        <CohortTab school={school} membership={membership} session={session} />
      ) : (
        <p className="flex-1 px-6 py-12 text-center text-sm text-slate-400">
          기수방은 <b className="text-slate-600">동문으로 등록한 사람</b>만 볼 수 있습니다.
          <br />위에서 졸업 연도를 등록해 주세요.
        </p>
      )}
    </aside>
  )
}

function TabButton({ active, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-indigo-600 text-indigo-700'
          : 'border-b-2 border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {children}
    </button>
  )
}

/** 기수방 = 기수 멤버 목록 + 기수 전용 게시판 */
function CohortTab({ school, membership, session }) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    let alive = true
    supabase
      .from('memberships')
      .select('id, nickname, created_at')
      .eq('school_id', school.id)
      .eq('grad_year', membership.grad_year)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (alive) setMembers(data ?? [])
      })
    return () => {
      alive = false
    }
  }, [school.id, membership.grad_year])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {membership.grad_year}년 졸업 동기 {members.length}명
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {m.nickname}
            </span>
          ))}
        </div>
      </div>

      <Guestbook
        key={`cohort-${school.id}-${membership.grad_year}`}
        schoolId={school.id}
        gradYear={membership.grad_year}
        userId={session.user.id}
        nickname={membership.nickname}
        canPost
      />
    </div>
  )
}

function JoinForm({ school, userId, defaultNickname, onCancel, onDone }) {
  const years = gradYearOptions()
  const [gradYear, setGradYear] = useState(years[Math.min(6, years.length - 1)])
  const [nickname, setNickname] = useState(defaultNickname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const name = nickname.trim()
    if (!name) {
      setError('별명을 입력해 주세요.')
      return
    }

    setBusy(true)
    setError('')

    const { data, error } = await supabase
      .from('memberships')
      .insert({
        user_id: userId,
        school_id: school.id,
        school_name: school.name,
        grad_year: Number(gradYear),
        nickname: name,
      })
      .select()
      .single()

    if (error) setError(toKoreanError(error))
    else onDone(data)
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">졸업 연도</span>
          <select
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">별명</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            maxLength={20}
            placeholder="예) 뒷자리 철수"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
          />
        </label>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? '등록 중…' : '등록'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-200"
        >
          취소
        </button>
      </div>
    </form>
  )
}
