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
