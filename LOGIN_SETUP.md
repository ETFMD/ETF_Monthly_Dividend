# 간편 로그인(카카오·네이버·구글) 켜는 방법

키를 하나도 등록하지 않으면 사이트에는 로그인 버튼이 보이지 않습니다(지금 상태).
**등록한 제공자만** 로그인 창에 나타나므로 하나씩 켜도 됩니다.

공통 주소
- 사이트 주소(서비스 URL): `https://d-capitalism.com`
- 리다이렉트(Callback) URI: `https://d-capitalism.com/auth/callback/` ← **끝의 `/` 까지 정확히**
- 개인정보처리방침: `https://d-capitalism.com/privacy/`
- 이용약관: `https://d-capitalism.com/terms/`

---

## 1. 카카오 (developers.kakao.com)

1. **내 애플리케이션 → 애플리케이션 추가**: 앱 이름 `디코딩 자본주의`, 회사명(개인이면 본인 이름 또는 사이트명), 아이콘.
2. **[앱] → [플랫폼 키] → [REST API 키]**
   - REST API 키 값 → GitHub 시크릿 `KAKAO_CLIENT_ID`
   - 같은 화면의 **리다이렉트 URI**에 `https://d-capitalism.com/auth/callback/` 등록
   - **클라이언트 시크릿**: 새 앱은 기본으로 켜져 있음 → 코드 값 → `KAKAO_CLIENT_SECRET` (**사실상 필수**)
3. **[카카오 로그인] → [사용 설정]**: 상태 **ON**.
4. **[카카오 로그인] → [동의항목]**: **닉네임(profile_nickname)** 만 `필수 동의`. 사용 목적 예: "서비스 내 회원 표시".
   이메일·전화번호 등 다른 항목은 켜지 마세요(최소 수집, 처리방침과 일치해야 함).
5. (선택) **[앱] → [어드민 키]** → `KAKAO_ADMIN_KEY`.
   등록하면 회원 탈퇴 때 카카오 쪽 연결도 자동으로 끊습니다(권장). Admin 키는 절대 외부에 노출 금지.
6. **카카오톡 공유(결과 카드 메시지)용** — 로그인과 별개로 아래 3가지를 해 주세요.
   - **[앱] → [플랫폼 키] → [JavaScript 키]** 값 → GitHub 시크릿 `KAKAO_JS_KEY` (공개돼도 되는 값)
   - 같은 화면의 **JavaScript SDK 도메인**에 `https://d-capitalism.com` 과 `https://www.d-capitalism.com` 등록
   - **[앱] → [제품 링크 관리] → [웹 도메인]** 에 `https://d-capitalism.com` 등록
     (등록하지 않으면 카카오톡 메시지의 [결과 보기]·[나도 해보기] 버튼 주소가 열리지 않음)
   - 키를 넣기 전에는 공유 창의 '카카오톡 공유'가 휴대폰 공유창(또는 PC에서는 링크 복사)으로 대신 동작합니다.

## 2. 네이버 (developers.naver.com)

1. **Application → 애플리케이션 등록**: 이름 `디코딩 자본주의`, 사용 API **네이버 로그인**.
2. 제공 정보: **별명(닉네임)** 만 `필수`. (이름·이메일·휴대전화 등은 선택하지 않음)
3. 로그인 오픈 API 서비스 환경: **PC 웹** → 서비스 URL `https://d-capitalism.com`,
   Callback URL `https://d-capitalism.com/auth/callback/`.
4. Client ID → `NAVER_CLIENT_ID`, Client Secret → `NAVER_CLIENT_SECRET`.
5. **중요 — 검수**: 등록 직후는 '개발 중' 상태라 **[멤버관리]에 넣은 테스트 계정만** 로그인됩니다.
   일반 사용자에게 열려면 **[네이버 로그인 검수 요청]**을 해야 합니다.
   (서비스 화면 캡처, 로그인 버튼 위치, 처리방침 링크 등을 제출. 네이버 로그인 버튼 디자인 가이드를 지켜야 통과)

## 3. 구글 (console.cloud.google.com)

1. 새 프로젝트 `d-capitalism` 생성.
2. **Google 인증 플랫폼(OAuth 동의 화면) → 브랜딩**
   - 앱 이름, 사용자 지원 이메일, (로고는 넣으면 브랜드 검수가 필요하니 처음엔 비워 둬도 됨)
   - 앱 홈페이지 / 개인정보처리방침 / 서비스 약관: 위 공통 주소
   - **승인된 도메인**: `d-capitalism.com` (나중에 로고·브랜드 검증을 받으려면 Google Search Console 도메인 소유 확인 필요)
3. **대상(Audience)**: 사용자 유형 **외부** → **앱 게시(프로덕션으로 푸시)**.
   '테스트' 상태로 두면 등록한 테스트 사용자 100명만 로그인되고 7일마다 다시 로그인이 필요합니다.
   사용하는 범위는 `openid profile` 뿐이라 민감 범위 심사는 필요 없습니다.
4. **클라이언트 → 클라이언트 만들기**: 유형 **웹 애플리케이션**,
   승인된 리디렉션 URI `https://d-capitalism.com/auth/callback/`.
5. 클라이언트 ID → `GOOGLE_CLIENT_ID`, 클라이언트 보안 비밀번호 → `GOOGLE_CLIENT_SECRET`.

## 4. GitHub 시크릿 등록 → 배포

저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 위에서 받은 값을 이름 그대로 등록:

| 이름 | 필수 |
|---|---|
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | 카카오 쓰면 둘 다 |
| `KAKAO_ADMIN_KEY` | 선택(탈퇴 시 연결 끊기) |
| `KAKAO_JS_KEY` | 카카오톡 공유 (결과 카드 메시지) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 쓰면 둘 다 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 구글 쓰면 둘 다 |

그다음 **Actions → "방문자 수 카운터 배포" → Run workflow**.
워크플로가 로그인 토큰 서명 키(`AUTH_SECRET`)를 처음 한 번 자동으로 만들고, 등록된 키를 Worker 비밀값으로 넣습니다.
몇 분 뒤(브라우저 탭을 새로 열면) 사이트 오른쪽 위에 **로그인** 버튼이 나타납니다.

## 주의

- Client Secret·Admin 키는 **GitHub 시크릿에만** 넣고 코드·채팅·메일에 붙여 넣지 마세요. (Client ID 는 공개돼도 괜찮음)
- 리다이렉트 URI 가 한 글자라도 다르면 로그인 실패(카카오 KOE006, 구글 redirect_uri_mismatch).
- `AUTH_SECRET` 을 바꾸면 모든 사용자가 로그아웃됩니다(유출 의심 시 Cloudflare 대시보드에서 교체).
- 처리방침·약관을 고치면 `terms/`·`privacy/` 의 시행일과 Worker 의 약관 버전(`TERMS_VER`)을 함께 갱신하세요.
