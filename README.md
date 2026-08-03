# 🎓 온라인 동창회

지도에서 모교를 찾아 방명록을 남기고, 같은 졸업 기수끼리만 이야기하는 웹앱.

전국 **12,011개 초·중·고**를 지도에 올리고, 학교를 누르면 그 학교의 방명록으로 들어갑니다.
졸업 연도를 등록하면 **같은 해 졸업한 사람만 볼 수 있는 기수방**이 열립니다.

| | |
|---|---|
| **지도** | 전국 학교 12,011곳 · 학교급/지역 필터 · 이름 검색 · 마커 클러스터링 |
| **방명록** | 학교별 전체 방명록 — 로그인한 누구나 읽고 쓰기 |
| **기수방** | 같은 학교 + 같은 졸업연도인 사람만 입장 (DB 권한으로 차단) |
| **동문 등록** | 한 계정으로 초·중·고 여러 학교에 등록 가능 |

---

## 기술 구성

- **프론트엔드** — Vite + React 19 + Tailwind CSS v4
- **지도** — Leaflet + markercluster (OpenStreetMap 타일, API 키 불필요)
- **백엔드** — Supabase (인증 + PostgreSQL + Row Level Security)
- **배포** — Cloudflare Pages (GitHub push 시 자동 배포)

### 학교 데이터

[공공데이터포털 전국초중등학교위치표준데이터](https://www.data.go.kr/data/15021148/standard.do)
(한국교육시설안전원, 기준일 2026-03-20)

원본 CSV는 `data/schools_raw.csv`에 두고, 빌드 스크립트가 앱용 JSON으로 변환합니다.

```bash
npm run build:schools   # data/schools_raw.csv → public/data/schools.json
```

852KB JSON을 번들에 넣지 않고 `public/`에 두는 이유는, 번들에 포함하면 JS 모듈로
변환되면서 크기가 1.5배(1.34MB)로 커지기 때문입니다. 정적 JSON이면 gzip 328KB로 끝납니다.

---

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # Supabase 키 입력
npm run dev
```

`.env.local`을 만들지 않아도 앱은 실행됩니다. 지도는 그대로 동작하고 로그인·방명록만 잠깁니다.

---

## Supabase 설정

1. [supabase.com](https://supabase.com)에서 무료 프로젝트를 만듭니다.
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 실행합니다.
   (테이블 3개 + RLS 정책 + 트리거가 한 번에 생성됩니다. 여러 번 실행해도 안전합니다.)
3. **Project Settings → Data API**에서 `Project URL`과 `anon public` 키를 복사해
   `.env.local`에 넣습니다.

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> `anon` 키는 브라우저에 노출되는 공개 키입니다. RLS가 데이터를 지키므로 노출돼도 안전합니다.
> **`service_role` 키는 절대 넣지 마세요.**

### 이메일 인증 끄기 (데모용, 선택)

기본값은 가입 시 확인 메일을 보냅니다. 시연할 때 번거로우면
**Authentication → Sign In / Providers → Email → Confirm email**을 끄면 가입 즉시 로그인됩니다.

### ⚠️ 무료 플랜 자동 정지

Supabase 무료 플랜은 [7일간 트래픽이 없으면 프로젝트를 정지](https://supabase.com/docs/guides/platform/free-project-pausing)시킵니다.
정지되면 배포된 사이트의 로그인·방명록이 전부 죽습니다.

이걸 막으려고 `.github/workflows/supabase-keepalive.yml`이 주 2회 핑을 보냅니다.
GitHub 저장소 **Settings → Secrets and variables → Actions**에 아래 두 개를 등록하세요.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## Cloudflare Pages 배포

1. GitHub에 push
2. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
3. 저장소를 선택하고 빌드 설정을 입력합니다.

| 항목 | 값 |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. **Settings → Environment variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를
   등록합니다. **Production과 Preview 양쪽 모두** 필요합니다.
5. 이후 `main`에 push할 때마다 자동 배포됩니다.

> 환경변수는 빌드 시점에 코드로 들어갑니다. 값을 바꾼 뒤에는 반드시 재배포하세요.

---

## 데이터 권한 구조

`supabase/schema.sql`의 RLS 정책이 접근을 제어합니다. 프론트엔드에서 막는 게 아니라
**데이터베이스가 직접 거부**하므로, 브라우저 콘솔로 API를 직접 호출해도 뚫리지 않습니다.

| 테이블 | 조회 | 작성 |
|---|---|---|
| `profiles` | 본인만 | 가입 시 자동 생성 |
| `memberships` | 본인 것 + 나와 같은 기수 | 본인만 |
| `posts` (학교 방명록) | 로그인한 누구나 | 로그인한 누구나 |
| `posts` (기수방) | 해당 기수 등록자만 | 해당 기수 등록자만 |

기수 확인은 `is_cohort_member()` 함수가 담당합니다.
RLS 정책이 `memberships`를 직접 조회하면 무한 재귀가 나기 때문에,
`security definer` 함수로 감싸 RLS를 우회합니다.

### 권한 검증

정책이 실제로 동작하는지 확인하는 스크립트가 있습니다.
계정 3개(같은 기수 2명 + 다른 기수 1명)를 만들어 17가지를 검사합니다.

```bash
npm run verify:rls
```

```
━━━ 5. 기수방 격리 (핵심) ━━━
  ✅ A가 2015 기수방에 작성
  ✅ 같은 기수 B는 읽을 수 있음
  ✅ 🔒 다른 기수 C는 읽을 수 없음
  ✅ 🔒 다른 기수 C는 쓸 수도 없음
```

실행하려면 `.env.local`이 있어야 하고, **Confirm email이 꺼져 있어야** 합니다.
(켜져 있으면 가입 시 세션이 발급되지 않아 스크립트가 중단되며, 무료 플랜의
시간당 메일 2통 제한에도 걸립니다.)

테스트 계정은 `rlstest-...@example.com` 형태로 남습니다.
**Authentication → Users**에서 지우면 됩니다.

---

## 알아두어야 할 한계

이 앱은 **수업 과제로 만든 데모**입니다. 실제 서비스로 쓰기 전에 아래를 해결해야 합니다.

- **졸업생 인증이 없습니다.** 아무나 아무 학교의 아무 기수로 등록할 수 있습니다.
  실서비스라면 졸업증명서 확인이나 기존 동문의 승인 같은 절차가 필요합니다.
- **신고·차단 기능이 없습니다.** 방명록에 부적절한 글이 올라와도 작성자 본인만 지울 수 있습니다.
- **실명을 받지 않습니다.** 별명만 사용합니다.
  실명 + 학교 + 졸업연도 조합은 개인 식별성이 매우 높아 의도적으로 피했습니다.
- 학교 데이터는 2026-03-20 기준입니다. 이후 폐교·신설 학교는 반영되지 않습니다.
  갱신하려면 원본 CSV를 다시 받아 `npm run build:schools`를 실행하세요.

---

## 명령어

```bash
npm run dev            # 개발 서버
npm run build          # 프로덕션 빌드 → dist/
npm run preview        # 빌드 결과 미리보기
npm run lint           # oxlint
npm run build:schools  # 학교 CSV → JSON 재생성
```
