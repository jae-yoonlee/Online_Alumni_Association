import { useState } from 'react'
import { supabase, toKoreanError } from '../lib/supabase'

export default function AuthPanel({ onClose }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isSignup = mode === 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || '동문' } },
        })
        if (error) throw error

        // 이메일 인증이 켜져 있으면 세션이 바로 생기지 않는다
        if (!data.session) {
          setNotice('가입 확인 메일을 보냈습니다. 메일함에서 인증을 완료한 뒤 로그인해 주세요.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(toKoreanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isSignup ? '회원가입' : '로그인'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSignup ? '가입하면 모교 방명록을 남길 수 있어요.' : '다시 오셨네요 👋'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignup && (
            <Field
              label="표시 이름"
              value={displayName}
              onChange={setDisplayName}
              placeholder="예) 3학년 2반 반장"
              maxLength={20}
              hint="실명 대신 별명을 권장합니다."
            />
          )}

          <Field
            label="이메일"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Field
            label="비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="6자 이상"
            required
            minLength={6}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? '처리 중…' : isSignup ? '가입하기' : '로그인'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? 'signin' : 'signup')
            setError('')
            setNotice('')
          }}
          className="mt-4 w-full text-sm text-slate-500 transition hover:text-indigo-600"
        >
          {isSignup ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}
