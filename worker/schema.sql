-- 방문자 수 카운터 (D1)
CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));   -- 그날 중복 확인용 해시 (2일 뒤 삭제)
CREATE TABLE IF NOT EXISTS daily  (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);        -- 날짜별 순방문자 수
CREATE TABLE IF NOT EXISTS cache  (k TEXT PRIMARY KEY, t INTEGER NOT NULL, v TEXT NOT NULL);     -- 외부 자료 짧은 캐시 (CNN 공포·탐욕 5분)
CREATE TABLE IF NOT EXISTS kr     (u TEXT PRIMARY KEY, want INTEGER NOT NULL, t INTEGER, st INTEGER, v TEXT);  -- 한국 수집기: 요청 주소 · 받은 시각 · 상태 · 내용
CREATE TABLE IF NOT EXISTS kr_lease (u TEXT PRIMARY KEY, until INTEGER NOT NULL);  -- 한국 수집기 여러 대: 같은 주소를 겹쳐 받지 않게 잠시 맡김
DELETE FROM cache WHERE k = 'kr_agent';  -- 예전 한 대용 기록
-- 간편 로그인 회원 (이메일·전화번호는 받지 않음) · 탈퇴하면 즉시 삭제
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, pid TEXT NOT NULL, nick TEXT, created INTEGER NOT NULL, last INTEGER, agreed INTEGER, terms_ver TEXT, ver INTEGER NOT NULL DEFAULT 0, UNIQUE (provider, pid));
-- 내 저장함: 계산기 입력값 스냅숏
CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER NOT NULL, page TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS saves_uid ON saves (uid, id);
-- 실시간 접속: 브라우저별 무작위 번호 · 마지막 신호 시각 (10분 지나면 정리)
CREATE TABLE IF NOT EXISTS live (s TEXT PRIMARY KEY, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS live_t ON live (t);
