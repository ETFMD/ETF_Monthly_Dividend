-- 방문자 수 카운터 (D1)
CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));   -- 그날 중복 확인용 해시 (2일 뒤 삭제)
CREATE TABLE IF NOT EXISTS daily  (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);        -- 날짜별 순방문자 수
CREATE TABLE IF NOT EXISTS cache  (k TEXT PRIMARY KEY, t INTEGER NOT NULL, v TEXT NOT NULL);     -- 외부 자료 짧은 캐시 (CNN 공포·탐욕 5분)
CREATE TABLE IF NOT EXISTS kr     (u TEXT PRIMARY KEY, want INTEGER NOT NULL, t INTEGER, st INTEGER, v TEXT);  -- 한국 수집기: 요청 주소 · 받은 시각 · 상태 · 내용
CREATE TABLE IF NOT EXISTS kr_lease (u TEXT PRIMARY KEY, until INTEGER NOT NULL);  -- 한국 수집기 여러 대: 같은 주소를 겹쳐 받지 않게 잠시 맡김
DELETE FROM cache WHERE k = 'kr_agent';  -- 예전 한 대용 기록
DELETE FROM kr WHERE u NOT LIKE 'https://kbam.co.kr/api/%';  -- 탐색용으로 받아 본 주소 정리 (지금은 KB API 만 사용)
