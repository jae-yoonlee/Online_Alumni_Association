/**
 * 온라인 동창회 — RLS(권한) 검증 스크립트
 *
 *   A, B → 2015년 졸업 (같은 기수)
 *   C    → 2016년 졸업 (다른 기수)
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const SCHOOL = { id: 'TEST-SCHOOL-RLS', name: '검증용가상학교' }

const stamp = process.env.STAMP ?? String(Date.now())
const pass = 'test-password-1234'

let passed = 0
let failed = 0

function check(label, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function makeUser(tag) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `rlstest-${stamp}-${tag}@example.com`

  const { data, error } = await client.auth.signUp({
    email,
    password: pass,
    options: { data: { display_name: `테스트${tag}` } },
  })
  if (error) throw new Error(`${tag} 가입 실패: ${error.message}`)
  if (!data.session) throw new Error('CONFIRM_EMAIL_ON')

  return { client, email, id: data.user.id }
}

// ── 1. 계정 생성 ────────────────────────────────────────────
console.log('\n━━━ 1. 회원가입 ━━━')
let A, B, C
try {
  A = await makeUser('a')
  B = await makeUser('b')
  C = await makeUser('c')
  check('사용자 3명 가입', true)
} catch (err) {
  if (err.message === 'CONFIRM_EMAIL_ON') {
    console.log('\n  ⚠️  가입은 됐지만 세션이 없습니다 → 이메일 인증(Confirm email)이 켜져 있습니다.')
    console.log('     Authentication → Sign In / Providers → Email → "Confirm email"을 끄고 다시 실행하세요.\n')
    process.exit(2)
  }
  console.log(`  ❌ ${err.message}\n`)
  process.exit(1)
}

// ── 2. 프로필 자동 생성 트리거 ──────────────────────────────
console.log('\n━━━ 2. 프로필 자동 생성 ━━━')
{
  const { data } = await A.client.from('profiles').select('display_name').eq('id', A.id).maybeSingle()
  check('가입 시 프로필이 자동 생성됨', data?.display_name === '테스트a', `받은 값: ${data?.display_name}`)
}

// ── 3. 동문 등록 ────────────────────────────────────────────
console.log('\n━━━ 3. 동문 등록 ━━━')
for (const [user, year, nick] of [
  [A, 2015, '에이'],
  [B, 2015, '비'],
  [C, 2016, '씨'],
]) {
  const { error } = await user.client.from('memberships').insert({
    user_id: user.id,
    school_id: SCHOOL.id,
    school_name: SCHOOL.name,
    grad_year: year,
    nickname: nick,
  })
  check(`${nick} → ${year}년 졸업 등록`, !error, error?.message)
}

{
  const { error } = await A.client.from('memberships').insert({
    user_id: A.id,
    school_id: SCHOOL.id,
    school_name: SCHOOL.name,
    grad_year: 2015,
    nickname: '중복',
  })
  check('같은 학교 중복 등록은 거부됨', Boolean(error))
}

{
  const { error } = await C.client.from('memberships').insert({
    user_id: A.id, // 남의 계정으로 등록 시도
    school_id: 'TEST-OTHER',
    school_name: '가짜',
    grad_year: 2015,
    nickname: '사칭',
  })
  check('남의 계정으로 동문 등록 시도는 거부됨', Boolean(error))
}

// ── 4. 학교 전체 방명록 ─────────────────────────────────────
console.log('\n━━━ 4. 학교 전체 방명록 (로그인한 누구나) ━━━')
{
  const { error } = await A.client.from('posts').insert({
    school_id: SCHOOL.id,
    grad_year: null,
    user_id: A.id,
    nickname: '에이',
    body: '전체 방명록 글입니다',
  })
  check('A가 전체 방명록에 작성', !error, error?.message)

  const { data } = await C.client
    .from('posts')
    .select('body')
    .eq('school_id', SCHOOL.id)
    .is('grad_year', null)
  check('다른 기수 C도 전체 방명록을 읽음', data?.length === 1, `${data?.length ?? 0}건`)
}

// ── 5. 기수방 격리 (핵심) ───────────────────────────────────
console.log('\n━━━ 5. 기수방 격리 (핵심) ━━━')
{
  const { error } = await A.client.from('posts').insert({
    school_id: SCHOOL.id,
    grad_year: 2015,
    user_id: A.id,
    nickname: '에이',
    body: '2015 기수만 보는 비밀 글',
  })
  check('A가 2015 기수방에 작성', !error, error?.message)

  const readAs = async (u) => {
    const { data } = await u.client
      .from('posts')
      .select('body')
      .eq('school_id', SCHOOL.id)
      .eq('grad_year', 2015)
    return data ?? []
  }

  check('같은 기수 B는 읽을 수 있음', (await readAs(B)).length === 1)
  check('🔒 다른 기수 C는 읽을 수 없음', (await readAs(C)).length === 0, `${(await readAs(C)).length}건이 새어나감!`)

  const { error: writeErr } = await C.client.from('posts').insert({
    school_id: SCHOOL.id,
    grad_year: 2015,
    user_id: C.id,
    nickname: '씨',
    body: '침입 시도',
  })
  check('🔒 다른 기수 C는 쓸 수도 없음', Boolean(writeErr), writeErr ? '' : '침입에 성공해버림!')
}

// ── 6. 기수 멤버 목록 ───────────────────────────────────────
console.log('\n━━━ 6. 기수 멤버 목록 ━━━')
{
  const { data: seenByA } = await A.client
    .from('memberships')
    .select('nickname, grad_year')
    .eq('school_id', SCHOOL.id)
  const nicks = (seenByA ?? []).map((m) => m.nickname).sort()
  check('A는 같은 기수(에이·비)만 봄', JSON.stringify(nicks) === JSON.stringify(['비', '에이']), `본 값: ${nicks}`)
  check('🔒 다른 기수 씨는 목록에 없음', !nicks.includes('씨'))
}

// ── 7. 글 삭제 권한 ─────────────────────────────────────────
console.log('\n━━━ 7. 삭제 권한 ━━━')
{
  const { data: post } = await A.client
    .from('posts')
    .select('id')
    .eq('school_id', SCHOOL.id)
    .is('grad_year', null)
    .single()

  await B.client.from('posts').delete().eq('id', post.id)
  const { data: still } = await A.client.from('posts').select('id').eq('id', post.id)
  check('🔒 남의 글은 삭제되지 않음', still?.length === 1)

  await A.client.from('posts').delete().eq('id', post.id)
  const { data: gone } = await A.client.from('posts').select('id').eq('id', post.id)
  check('내 글은 삭제됨', gone?.length === 0)
}

// ── 정리 ────────────────────────────────────────────────────
for (const u of [A, B, C]) {
  await u.client.from('posts').delete().eq('school_id', SCHOOL.id)
  await u.client.from('memberships').delete().eq('school_id', SCHOOL.id)
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  통과 ${passed} / 실패 ${failed}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
process.exit(failed ? 1 : 0)
