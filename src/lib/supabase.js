import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Supabase 환경변수가 없어도 앱은 뜨고 지도는 동작한다.
 * (설정 전에도 화면을 확인할 수 있도록 — 대신 로그인/방명록은 잠긴다)
 */
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** Supabase 오류 메시지를 사용자가 읽을 수 있는 한국어로 바꾼다 */
export function toKoreanError(error) {
  if (!error) return ''
  const msg = error.message ?? String(error)

  if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (/User already registered/i.test(msg)) return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (/Password should be at least/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다.'
  if (/Unable to validate email address/i.test(msg)) return '이메일 형식이 올바르지 않습니다.'
  if (/Email not confirmed/i.test(msg)) return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.'
  if (/duplicate key/i.test(msg) && /memberships/i.test(msg)) return '이미 이 학교에 동문으로 등록되어 있습니다.'
  if (/row-level security/i.test(msg)) return '권한이 없습니다. 해당 기수의 동문만 이용할 수 있습니다.'
  if (/rate limit|too many/i.test(msg)) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.'

  return msg
}
