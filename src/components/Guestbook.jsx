import { useCallback, useEffect, useState } from 'react'
import { supabase, toKoreanError } from '../lib/supabase'

const MAX_LEN = 500

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' })
}

/**
 * 방명록 피드 + 작성창.
 * gradYear가 null이면 학교 전체 방명록, 숫자면 해당 기수 전용 게시판.
 */
export default function Guestbook({ schoolId, gradYear = null, nickname, userId, canPost, lockedReason }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    let query = supabase
      .from('posts')
      .select('id, nickname, body, created_at, user_id')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(100)

    query = gradYear === null ? query.is('grad_year', null) : query.eq('grad_year', gradYear)

    const { data, error } = await query
    if (error) setError(toKoreanError(error))
    setPosts(data ?? [])
    setLoading(false)
  }, [schoolId, gradYear])

  useEffect(() => {
    setPosts([])
    load()
  }, [load])

  async function submit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return

    setBusy(true)
    setError('')

    const { error } = await supabase.from('posts').insert({
      school_id: schoolId,
      grad_year: gradYear,
      user_id: userId,
      nickname,
      body: text,
    })

    if (error) {
      setError(toKoreanError(error))
    } else {
      setBody('')
      await load()
    }
    setBusy(false)
  }

  async function remove(id) {
    if (!confirm('이 글을 삭제할까요?')) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) setError(toKoreanError(error))
    else setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {canPost ? (
        <form onSubmit={submit} className="border-b border-slate-100 px-4 py-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
            rows={2}
            placeholder={
              gradYear === null ? '모교에 인사를 남겨보세요…' : `${gradYear}년 졸업 동기들에게 하고 싶은 말…`
            }
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              <b className="font-semibold text-slate-600">{nickname}</b> 이름으로 남깁니다 · {body.length}/{MAX_LEN}
            </span>
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              {busy ? '등록 중…' : '남기기'}
            </button>
          </div>
        </form>
      ) : (
        lockedReason && (
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">{lockedReason}</p>
        )
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p>
        ) : posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            아직 글이 없습니다.
            {canPost && ' 첫 글을 남겨보세요!'}
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="group rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{p.nickname}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {timeAgo(p.created_at)}
                    {p.user_id === userId && (
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="ml-2 text-slate-300 transition hover:text-rose-500"
                        aria-label="삭제"
                      >
                        삭제
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap text-slate-700">{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
