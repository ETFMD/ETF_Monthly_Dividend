# 시세 데이터 자동 갱신 설정 (최초 1회)

1. 이 폴더의 파일을 저장소 루트에 그대로 올립니다.
   - `index.html`
   - `scripts/update_market_data.py`
   - `.github/workflows/update-market-data.yml`
   - `data/.gitkeep`
2. 저장소 **Settings → Actions → General → Workflow permissions** 에서
   **Read and write permissions** 를 선택하고 저장합니다.
3. **Actions** 탭 → `시세 데이터 갱신` → **Run workflow** 를 한 번 눌러 첫 데이터를 만듭니다.
   (1~2분 후 `data/market.json`, `data/history.json` 이 생기면 완료)

이후에는 한국장·미국장 시간에 15분마다, 그 외에는 3시간마다 자동으로 갱신됩니다.
데이터가 바뀐 경우에만 커밋되므로 장 마감 후에는 커밋이 쌓이지 않습니다.

# 도구별 주소·검색 노출 (자동)

- 원본은 루트 `index.html` 하나입니다. 고쳐서 올리면 Actions `도구별 주소 페이지 생성` 이
  `loan/`, `fx/` 같은 도구별 페이지와 `sitemap.xml`·`robots.txt`·`404.html` 을 자동으로 다시 만듭니다.
  (`loan/index.html` 같은 생성 파일은 직접 고치지 마세요 — 다음 생성 때 덮어씁니다)
- 도구 이름·검색 설명을 바꾸려면 `scripts/routes.json` 을 고칩니다.
  공유 미리보기 이미지(`assets/og/*.png`)는 `node scripts/make_og_images.js` 로 다시 만들 수 있습니다.
- 자체 도메인을 연결하면 저장소 루트에 `CNAME` 파일(도메인 한 줄)을 두면 됩니다. 모든 주소·sitemap 이 그 도메인으로 바뀝니다.
- 검색 등록: 구글 서치콘솔·네이버 서치어드바이저에 사이트를 등록하고 `sitemap.xml` 주소를 제출합니다.

# 방문자 수 (맨 위 "오늘 N명 · 전체 N명")

같은 IP는 하루(한국 시간) 1번만 셉니다. GitHub Pages는 서버가 없어 IP를 볼 수 없으므로 무료 Cloudflare Worker + D1 데이터베이스(`worker/`)가 셉니다.
IP 원문은 저장하지 않고, 하루 단위로 바뀌는 해시만 중복 확인용으로 2일간 보관합니다.

처음 한 번만 설정:
1. https://dash.cloudflare.com 가입 → 왼쪽 **Workers & Pages** 를 한 번 열어 `workers.dev` 하위 도메인을 정합니다.
2. 오른쪽 위 프로필 → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" 템플릿** 선택 →
   Permissions 에 **Account · D1 · Edit** 를 한 줄 추가 → Account Resources 는 내 계정 → 토큰 생성 후 복사.
3. Cloudflare 대시보드 Workers & Pages 화면 오른쪽의 **Account ID** 복사.
4. GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret** 에
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 두 개 등록.
5. **Actions → 방문자 수 카운터 배포 → Run workflow**. 데이터베이스 생성·Worker 배포·`data/counter.json` 저장까지 자동으로 끝나면 몇 분 안에 사이트 맨 위에 방문자 수가 나타납니다.
