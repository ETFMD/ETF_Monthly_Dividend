-- 방문자 수 카운터 (D1)
CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));   -- 그날 중복 확인용 해시 (2일 뒤 삭제)
CREATE TABLE IF NOT EXISTS daily  (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);        -- 날짜별 순방문자 수
