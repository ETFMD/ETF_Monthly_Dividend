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
