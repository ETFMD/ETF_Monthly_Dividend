#!/usr/bin/env python3
"""영어 페이지(/en/<도구>/)용 번역 데이터를 scripts/i18n/en.json 으로 만든다.
· text   : 한국어 원문 글자 덩어리(HTML 태그 사이 글자, 앞뒤 공백 제외) → 영어
           build_pages.py 가 상단 메뉴·하단·영어판 도구 화면에만 적용 (스크립트·스타일·주석 안은 건드리지 않음)
· guides : 도구별 영어 설명글 (한국어 [GUIDE:tab] 구간을 통째로 바꿈) — 숫자는 한국어 설명글과 같은 계산 결과
· 화면에서 JS 가 만드는 글자(계산 결과 문장 등)는 영어 페이지에서도 구글 자동 번역이 처리
사용: python3 scripts/i18n/make_en.py  (그다음 python3 scripts/build_pages.py)"""
import json, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'en.json')

TEXT = {
    # ── 상단 줄 · 메뉴 ──
    '실시간': 'Online now', '오늘': 'Today', '명': '', '전체': 'Total', '방문자 수': 'Visitors', '어제': 'Yesterday', '최대': 'Peak day',
    '한국어': '한국어', 'Language / 언어': 'Language',   # 언어 선택 목록은 각 언어 이름 그대로
    '카카오 오픈채팅': 'KakaoTalk open chat (Korean)',
    'ETF 커버드콜 + 배당투자 + 성장주 함께 장기투자를 위한 오픈톡방 가기': 'Join our Korean-language community for long-term investing in covered-call ETFs, dividends and growth stocks',
    '전체 도구': 'All tools', '법인세 계산기': 'Korean corporate tax', '소개': 'About', '이용약관': 'Terms', '투자 면책': 'Disclaimer', '공포 & 탐욕 지수': 'Fear & Greed Index', '디코딩 자본주의': 'Decoding Capitalism', '디코딩 자본주의 홈': 'Decoding Capitalism home', '사이트 검색': 'Site search', '검색 결과': 'Search results',
    '계산기·자료 검색 (예: 연봉, 취득세, 배당)': 'Search tools (e.g. salary, tax, dividend)',
    '돈': 'Money', '주식·ETF': 'Stocks & ETFs', '부동산': 'Real estate', '패시브인컴': 'Passive income', '내 위치': 'Where I stand', '노동자': 'Worker', '자본가': 'Capitalist', '노동자 계산기 모음': 'Worker Calculators', '자본가 계산기 모음': 'Capitalist Calculators', '국민연금 손익 계산기': 'National Pension ROI Calculator', '그때 샀더라면 계산기': 'What-If Investment Calculator', '내 연봉으로 집 사기까지 몇 년': 'Years to Buy a Home on My Salary', '내 위치 진단 도구 모음': 'Where I Stand — Diagnosis Tools', '노후 준비 성적표': 'Retirement Readiness Score', '배당금 계산기': 'Dividend Calculator', '부동산 계산기 모음': 'Real Estate Calculators', '부동산 양도소득세 계산기': 'Real Estate Capital Gains Tax Calculator', '불로소득 도구 모음': 'Passive Income Tools', '연말정산 환급 계산기': 'Year-End Tax Refund Calculator', '월급·세금 계산기 모음': 'Pay & Tax Calculators', '재산세 계산기': 'Property Tax Calculator', '종합부동산세 계산기': 'Comprehensive Real Estate Holding Tax Calculator', '주식 물타기 계산기': 'Stock Averaging-Down Calculator', '청약 가점 계산기': 'Housing Subscription Score Calculator', '투자 계산기·지수 모음': 'Investing Calculators & Indices', '파이어족 계산기': 'FIRE Calculator', '현재 위치': 'Breadcrumb', '월급·세금': 'Pay & tax', '투자': 'Investing', '불로소득': 'Passive income', '커버드콜 분배 시뮬레이터': 'Covered-call simulators',
    'ETF 월분배 및 배당 달력': 'Korean ETF distribution calendar', '국내 나의 아파트 시세 순위': 'Korean apartment price ranking', '국내 나의 연봉 순위': 'My salary rank in Korea',
    '국내 나의 자산 순위': 'My net-worth rank in Korea', '배당소득세 계산기': 'Korean dividend income tax', '연금저축·IRP 세액공제 계산기': 'Korean pension savings tax credit', '전세계 시가총액 TOP 100': 'Global market cap TOP 100',
    '홈': 'Home', '분배 시뮬레이터': 'Distribution simulators', '금융 계산기': 'Financial calculators', '기타 금융 자료': 'Market data',
    '지수 성장률': 'Index growth', '미국 지수 성장률': 'U.S. index growth', '한국 지수 성장률': 'Korean index growth',
    '다크': 'Dark', '라이트': 'Light', '오토': 'Auto', '(기기 설정 따라감)': '(follow device)', '테마': 'Theme',
    # ── 하단 ──
    '후원 및 문의': 'Support & contact', '카카오 오픈 1:1채팅으로 연결됩니다': 'Opens a KakaoTalk 1:1 chat (Korean)',
    '개인정보처리방침': 'Privacy policy', '문의': 'Contact', '© 디코딩 자본주의': '© Decoding Capitalism',
    '이 사이트의 모든 계산 결과와 자료는 참고용이며 투자 판단의 책임은 이용자 본인에게 있습니다.': 'All calculations and data on this site are for reference only. Investment decisions and their consequences are your own responsibility.',
    # ── 드롭다운 메뉴 (도구 이름) ──
    'KODEX 200타겟위클리커버드콜': 'KODEX 200 Target Weekly Covered Call', 'SOL 200타겟위클리커버드콜': 'SOL 200 Target Weekly Covered Call',
    'TIGER 200타겟위클리커버드콜': 'TIGER 200 Target Weekly Covered Call', 'TIGER 배당커버드콜액티브': 'TIGER Dividend Covered Call Active',
    'TIGER 반도체TOP10커버드콜액티브': 'TIGER Semiconductor TOP10 Covered Call Active',
    '대출 이자 계산기': 'Loan interest calculator', '복리 계산기': 'Compound interest calculator', 'CAGR 계산기': 'CAGR calculator',
    '환율 계산기': 'Currency converter', '건강보험료 계산기': 'Korean health insurance', '연봉 실수령액 계산기': 'Korean net salary',
    '퇴직금 계산기': 'Korean severance pay', '주담대 LTV·DSR 한도 계산기': 'Korean mortgage LTV·DSR limit', '부동산 중개수수료 계산기': 'Korean brokerage fee',
    '공포 &amp; 탐욕 지수': 'Fear &amp; Greed Index', '돈, 자산, 노동의 가치 속도': 'Money, assets & wages in Korea', '무한매수법 기록': 'Infinite buying (TQQQ·SOXL)',
    'ETF CAGR 비교': 'ETF CAGR comparison', '코스피 성장률': 'KOSPI growth', '코스피 200 성장률': 'KOSPI 200 growth', '코스닥 성장률': 'KOSDAQ growth',
    '세금 계산기': 'Tax calculators', '종합소득세 계산기': 'Korean comprehensive income tax', '해외주식 양도소득세 계산기': 'Korean tax on foreign stock gains', '배당소득세·금융소득종합과세': 'Korean dividend & financial income tax',
    '연금저축·IRP 세액공제': 'Korean pension savings tax credit', '증여세·상속세 계산기': 'Korean gift & inheritance tax', '부동산 취득세 계산기': 'Korean property acquisition tax',
    '일본 지수 성장률': 'Japanese index growth', '중국 지수 성장률': 'Chinese index growth', '홍콩 지수 성장률': 'Hong Kong index growth', '대만 지수 성장률': 'Taiwanese index growth',
    '닛케이 225 성장률': 'Nikkei 225 growth', 'TOPIX 성장률': 'TOPIX growth', '상해종합지수 성장률': 'SSE Composite growth', 'CSI 300 성장률': 'CSI 300 growth',
    '선전성분지수 성장률': 'SZSE Component growth', '창업판지수 성장률': 'ChiNext growth', '과창판50 성장률': 'STAR 50 growth',
    '항셍지수 성장률': 'Hang Seng growth', '홍콩H지수 성장률': 'Hang Seng China Enterprises growth', '항셍테크지수 성장률': 'Hang Seng TECH growth', '대만 가권지수 성장률': 'TAIEX growth',
    '나스닥 종합 성장률': 'NASDAQ Composite growth', '나스닥 100 성장률': 'Nasdaq-100 growth', '다우존스 성장률': 'Dow Jones growth',
    'S&P 500 성장률': 'S&P 500 growth', '필라델피아 반도체 성장률': 'PHLX Semiconductor (SOX) growth', '다우존스 반도체 성장률': 'DJ US Semiconductors growth',
    # ── 지수 성장률 공통 ──
    '성장률 분석': 'growth rate analysis', '지수 갱신': 'Refresh', '기준일': 'As of', '데이터 없음': 'No data', '⏳ 조회 중...': '⏳ Loading...',
    '최근 5년': 'Last 5Y', '최근 10년': 'Last 10Y', '최근 15년': 'Last 15Y', '최근 20년': 'Last 20Y', '최근 30년': 'Last 30Y', '전체 기간': 'All time',
    '연평균 성장률 (CAGR)': 'Compound annual growth rate (CAGR)', '월평균 성장률': 'Average monthly growth', 'CAGR의 월 환산': 'CAGR converted to a monthly rate',
    '일평균 성장률': 'Average daily growth', 'CAGR의 일 환산': 'CAGR converted to a daily rate',
    '10년 후': 'After 10 years', '20년 후': 'After 20 years', '30년 후': 'After 30 years', '40년 후': 'After 40 years',
    '※ 과거 성장률이 미래를 보장하지 않습니다.': '※ Past growth does not guarantee future results.',
    # S&P 500
    '1928년 1월 3일 기준지수 산출 시작 — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Data from January 3, 1928 — annual, monthly and daily average growth up to today’s level',
    'S&P 500이란?': 'What is the S&P 500?',
    "(Standard & Poor's 500)은 뉴욕증권거래소(NYSE)와 나스닥에 상장된 미국 대형주 500개 종목으로 구성되는 시가총액 가중 종합주가지수입니다. 미국 전체 주식 시가총액의 약 80%를 커버하며, 전 세계에서 가장 널리 추적되는 주가지수입니다.":
        " (Standard &amp; Poor's 500) is a market-cap-weighted index of 500 large U.S. companies listed on the NYSE and Nasdaq. It covers roughly 80% of total U.S. equity market value and is the most widely tracked stock index in the world.",
    '현재 S&P 500 지수': 'Current S&amp;P 500', '기준 1928.01.03 → 현재': 'Base 1928-01-03 → today',
    'S&P 500 CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the S&amp;P 500 CAGR',
    # NASDAQ
    '나스닥 종합지수': 'NASDAQ Composite', '1971년 2월 8일 기준지수 100 출발 — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Base 100 on February 8, 1971 — annual, monthly and daily average growth up to today’s level',
    '나스닥이란?': 'What is the NASDAQ Composite?', '나스닥': 'NASDAQ Composite',
    '(NASDAQ, National Association of Securities Dealers Automated Quotations)는 나스닥 거래소에 상장된 전체 종목의 시가총액 가중 종합주가지수입니다. 애플·마이크로소프트·엔비디아·알파벳(구글)·아마존·메타 등 글로벌 빅테크 기업이 대거 포함되어 있으며, 기술주 중심의 미국 증시 흐름을 대표합니다.':
        ' is a market-cap-weighted index of all common stocks listed on the Nasdaq exchange. It is dominated by global tech giants such as Apple, Microsoft, Nvidia, Alphabet (Google), Amazon and Meta, and is the benchmark for U.S. technology stocks.',
    '현재 NASDAQ Composite 지수': 'Current NASDAQ Composite', '기준 1971.02.08 → 현재': 'Base 1971-02-08 → today',
    'NASDAQ Composite CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the NASDAQ Composite CAGR',
    # Nasdaq-100
    '나스닥 100': 'Nasdaq-100', '1985년 1월 31일 기준지수 250 출발 — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Base 250 on January 31, 1985 — annual, monthly and daily average growth up to today’s level',
    '나스닥 100이란?': 'What is the Nasdaq-100?',
    '(NASDAQ 100)은 나스닥 거래소 상장 비금융 기업 중 시가총액 상위 100개 종목으로 구성되는 주가지수입니다. 기술·바이오·소비재 섹터 대형주가 집중되어 있으며, QQQ ETF의 추적지수로 널리 사용됩니다.':
        ' tracks the 100 largest non-financial companies listed on Nasdaq by market value. It is concentrated in technology, biotech and consumer large caps and is best known as the index behind the QQQ ETF.',
    '현재 NASDAQ 100 지수': 'Current Nasdaq-100', '기준 1985.01.31 → 현재': 'Base 1985-01-31 → today',
    'NASDAQ 100 CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the Nasdaq-100 CAGR',
    # Dow
    '다우존스 산업평균지수': 'Dow Jones Industrial Average', '1896년 5월 26일 산출 시작 — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Since May 26, 1896 — annual, monthly and daily average growth up to today’s level',
    '다우존스란?': 'What is the Dow Jones?', '다우존스': 'Dow Jones',
    '(Dow Jones Industrial Average, DJIA)는 미국을 대표하는 30개 우량 대형주의 주가 평균을 기반으로 산출하는 주가지수입니다. 가장 오래된 주가지수 중 하나로, 보잉·골드만삭스·JP모건·애플·나이키 등이 포함되어 있습니다.':
        ' (DJIA) is a price-weighted average of 30 leading U.S. blue-chip companies. One of the oldest stock indices in the world, it includes names such as Boeing, Goldman Sachs, JPMorgan, Apple and Nike.',
    '현재 Dow Jones 지수': 'Current Dow Jones', '기준 1896.05.26 → 현재': 'Base 1896-05-26 → today',
    'Dow Jones CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the Dow Jones CAGR',
    # SOX
    '필라델피아 반도체지수': 'PHLX Semiconductor Index', '1993년 12월 1일 기준지수 200 출발 — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Base 200 on December 1, 1993 — annual, monthly and daily average growth up to today’s level',
    '필라델피아 반도체지수(SOX)란?': 'What is the PHLX Semiconductor Index (SOX)?',
    '(PHLX Semiconductor Index, 티커 SOX)는 나스닥이 산출하는 미국 상장 반도체 기업 30개(설계·제조·장비·소재)로 구성된 지수입니다. 1993년 12월 1일 기준지수 200으로 시작했으며, 반도체 업황을 대표하는 지표로 가장 널리 쓰입니다. 업황에 따라 등락 폭이 큰 편이라 같은 기간이라도 시작 시점에 따라 성장률 차이가 큽니다.':
        ' (ticker SOX) is calculated by Nasdaq from 30 U.S.-listed semiconductor companies across design, manufacturing, equipment and materials. It started at 200 on December 1, 1993 and is the most widely used gauge of the chip cycle. Because the sector swings sharply, growth rates depend heavily on the starting date.',
    '현재 필라델피아 반도체지수': 'Current SOX', '기준 1993.12.01 → 현재': 'Base 1993-12-01 → today',
    '필라델피아 반도체지수 CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the SOX CAGR',
    # DJUSSC
    '다우존스 미국 반도체 지수': 'Dow Jones U.S. Semiconductors Index',
    'Dow Jones U.S. Semiconductors Index (DJUSSC) — 현재 지수 기반 연평균·월평균·일평균 성장률': 'Dow Jones U.S. Semiconductors Index (DJUSSC) — annual, monthly and daily average growth up to today’s level',
    '다우존스 미국 반도체 지수(DJUSSC)란?': 'What is the Dow Jones U.S. Semiconductors Index (DJUSSC)?',
    '(Dow Jones U.S. Semiconductors Index, 티커 DJUSSC)는 S&amp;P 다우존스 인디시즈가 산출하는 지수로, 미국 상장 기업 중 반도체 세부 업종에 속한 기업들의 주가 성과를 측정합니다. 반도체 2배 레버리지 ETF인 ProShares Ultra Semiconductors(USD)의 기초지수이기도 합니다. 필라델피아 반도체지수(SOX)와 함께 반도체 업황을 보여 주는 지표이며, 업황에 따라 등락 폭이 커서 시작 시점에 따라 성장률 차이가 큽니다.':
        ' (ticker DJUSSC) is published by S&amp;P Dow Jones Indices and measures U.S.-listed companies in the semiconductor sub-industry. Together with the SOX it tracks the chip cycle, and because it swings sharply, growth rates depend heavily on the starting date.',
    '※ 전체 기간은 이 사이트가 보유한 과거 데이터의 첫 날짜부터 계산합니다.': '※ “All time” starts from the first date in this site’s historical data.',
    '현재 다우존스 미국 반도체 지수': 'Current DJUSSC', '기준 — → 현재': 'Start — → today',
    '다우존스 미국 반도체 지수 CAGR 기준 1억 투자 시뮬레이션': 'Growth of ₩100 million at the DJUSSC CAGR',
    # ── 복리 계산기 ──
    '& 적립식 복리': '&amp; monthly contributions', '원금·적립금·이율·기간으로 최종 자산과 수익을 시뮬레이션합니다': 'Simulate your final balance and earnings from principal, monthly contributions, rate and term',
    '일반 복리': 'Lump sum', '적립식 복리': 'With monthly contributions', '투자 조건 설정': 'Investment settings', '초기 투자금액': 'Initial investment',
    '억원': '₩100M', '만원': '₩10K', '원': '₩', '연 이율': 'Annual rate', '투자 기간': 'Term', '년': 'yrs', '복리 주기': 'Compounding',
    '연 1회': 'Annually', '반기 2회': 'Semiannually', '분기 4회': 'Quarterly', '월 12회': 'Monthly', '주 52회': 'Weekly', '일 365회': 'Daily',
    '적립식 설정': 'Contribution settings', '월 적립금': 'Monthly contribution', '연간 추가 투자액': 'Contributions per year',
    '세금 설정': 'Tax settings', '이자소득세 공제': 'Deduct interest tax', '세율': 'Tax rate', '일반 15.4%': 'Korea 15.4%', '소득세 9.9%': '9.9%', '비과세 0%': 'Tax-free 0%',
    '※ 복리 계산은 세전 이율 기준이며, 세금 공제 선택 시 이자에만 적용됩니다.': '※ The rate is pre-tax; when tax is on, it applies to interest only.',
    '※ 과거 수익률이 미래를 보장하지 않습니다.': '※ Past returns do not guarantee future results.',
    '최종 자산': 'Final balance', '총 수익금': 'Total earnings', '수익률 —': 'Return —', '실효 CAGR': 'Effective CAGR', '월평균 —': 'Monthly —',
    '연도별 자산 성장': 'Balance by year', '자산 규모': 'Balance', '수익률': 'Return', '연도별 성장 내역': 'Year-by-year breakdown', '연도': 'Year',
    '원금 누계': 'Principal', '적립 누계': 'Contributions', '이자 누계': 'Interest', '총 자산': 'Balance',
    # ── CAGR 계산기 ──
    '연평균 성장률': 'Compound annual growth rate', '초기 금액과 최종 금액으로 연평균 수익률을 계산합니다': 'Calculate the annualized return from a starting and an ending value',
    '투자 정보 입력': 'Inputs', '초기 금액': 'Starting value', '최종 금액': 'Ending value', '년수': 'Years', '날짜': 'Dates', '시작일': 'Start date', '종료일': 'End date',
    '기간: —': 'Period: —', '역산 모드': 'Reverse mode', '목표 CAGR로 필요 최종금액 계산': 'Ending value needed at a target CAGR', '목표 CAGR': 'Target CAGR',
    '필요 최종금액': 'Required ending value', '목표 CAGR로 최종 금액에 도달하는 데 필요한 기간': 'Years needed to reach the ending value at the target CAGR', '필요 기간': 'Years needed',
    '※ CAGR = (최종금액 / 초기금액)^(1/기간) − 1': '※ CAGR = (ending ÷ starting)^(1/years) − 1', '※ 세금 및 거래비용 미반영 세전 수치입니다.': '※ Pre-tax, before trading costs.',
    '계산 중...': 'Calculating...', '총 수익률': 'Total return', '자산 2배 도달': 'Years to double', '자산 10배 도달': 'Years to 10×',
    '연간 수익금': 'Gain that year', '누적 수익금': 'Cumulative gain', '누적 수익률': 'Cumulative return', 'CAGR 연도별 자산 성장 차트': 'Value by year at the CAGR',
    # ── 공포 & 탐욕 ──
    '공포': 'Fear', '탐욕': 'Greed', '&amp; 탐욕 지수': '&amp; Greed Index', '시장 심리 및 금융 지표 모음': 'Market sentiment and financial indicators',
    '미국 주식 시장 투자 심리 · CNN': 'U.S. stock market sentiment · CNN', '현재 공포 &amp; 탐욕 지수': 'Current Fear &amp; Greed Index', '갱신': 'Refresh',
    '전일': 'Previous close', '1주 전': '1 week ago', '1달 전': '1 month ago', '1년 전': '1 year ago', '구성 지표': 'Components', '데이터 로딩 중...': 'Loading data...',
    '구성 지표 설명': 'How the components work', '설명': 'What', '해석': 'Reading',
    '(주가 모멘텀 - S&amp;P 500)': '(S&amp;P 500 momentum)', '&nbsp; S&amp;P 500 지수를 최근 125거래일 이동평균과 비교합니다.': '&nbsp; Compares the S&amp;P 500 with its 125-day moving average.',
    '&nbsp; 지수가 이동평균보다 높을수록 상승 추세가 강하다는 뜻이라': '&nbsp; The further the index is above its average, the stronger the uptrend:',
    ', 낮을수록': '; the further below:', '로 봅니다.': '.',
    '(주가 강도 - 52주 신고가 vs 신저가)': '(52-week highs vs lows)',
    '&nbsp; 뉴욕증권거래소(NYSE)에서 52주 신고가를 기록한 종목 수와 52주 신저가를 기록한 종목 수를 비교합니다.': '&nbsp; Compares the number of NYSE stocks hitting 52-week highs with those hitting 52-week lows.',
    '&nbsp; 신고가 종목이 신저가 종목보다 훨씬 많으면': '&nbsp; Far more new highs than new lows:', ', 신저가 종목이 많으면': '; more new lows:', '입니다.': '.',
    '(주가 폭 - 상승·하락 거래량)': '(advancing vs declining volume)',
    '&nbsp; 맥클렐런 거래량 합산 지수(McClellan Volume Summation Index)로, 오르는 종목에 몰린 거래량과 내리는 종목에 몰린 거래량을 비교합니다.': '&nbsp; Uses the McClellan Volume Summation Index to compare volume in rising stocks with volume in falling stocks.',
    '&nbsp; 상승 종목 쪽 거래량이 많으면': '&nbsp; More volume in advancing stocks:', ', 하락 종목 쪽 거래량이 많으면': '; more in declining stocks:', '로 해석합니다.': '.',
    '(풋/콜 비율)': '(put/call ratio)', '&nbsp; 하락에 베팅하는 풋옵션 거래량을 상승에 베팅하는 콜옵션 거래량으로 나눈 비율의 5일 평균입니다.': '&nbsp; The 5-day average of put option volume (bets on a fall) divided by call option volume (bets on a rise).',
    '&nbsp; 비율이 높아질수록(풋 증가) 하락에 대비하는 투자자가 많다는 뜻이라': '&nbsp; A rising ratio (more puts) means more investors are hedging against a drop:', ', 낮아질수록': '; a falling ratio:',
    '(시장 변동성 - VIX)': '(market volatility · VIX)', '&nbsp; S&amp;P 500 옵션 가격으로 산출한 향후 30일 예상 변동성(VIX)을 50일 이동평균과 비교합니다.': '&nbsp; Compares the VIX — expected 30-day volatility implied by S&amp;P 500 options — with its 50-day moving average.',
    '&nbsp; VIX가 평균보다 높으면 불확실성이 커진': '&nbsp; VIX above its average signals rising uncertainty:', ', 낮으면 시장이 안정적인': '; below average, a calm market:', '으로 봅니다.': '.',
    '(안전자산 수요)': '(safe-haven demand)', '&nbsp; 최근 20거래일 동안 주식과 국채의 수익률 차이를 비교합니다.': '&nbsp; Compares stock and Treasury returns over the last 20 trading days.',
    '&nbsp; 국채 수익률이 주식보다 좋으면 안전자산으로 돈이 몰리는': '&nbsp; Bonds beating stocks means money is moving to safety:', ', 주식이 앞서면': '; stocks ahead:',
    '(정크본드 수요)': '(junk bond demand)', '&nbsp; 신용등급이 낮은 투기등급 채권(정크본드)과 투자등급 채권의 수익률 차이(스프레드)를 봅니다.': '&nbsp; Looks at the yield spread between junk (high-yield) bonds and investment-grade bonds.',
    '&nbsp; 스프레드가 좁아지면 위험을 감수하려는': '&nbsp; A narrowing spread signals appetite for risk:', ', 넓어지면 위험을 피하는': '; a widening spread signals risk aversion:', '신호입니다.': '.',
    'Fear &amp; Greed 추이 (최근 90일)': 'Fear &amp; Greed trend (last 90 days)',
    '데이터 출처: CNN Business Fear &amp; Greed Index · 15분 간격 수집 · 투자 참고용이며 투자 권고가 아닙니다.': 'Source: CNN Business Fear &amp; Greed Index · collected every 15 minutes · for reference only, not investment advice.',
    # ── ETF CAGR 비교 ──
    'CAGR 비교': 'CAGR comparison', '미국 대표 지수·레버리지 ETF 12종 — 시작일부터 매 거래일까지의 연평균 성장률(CAGR) 추이 비교': '12 U.S. index and leveraged ETFs — CAGR from the start date to every trading day since',
    '기간별 CAGR 추이': 'CAGR over time', '주가': 'Price', '분배금 포함': 'With distributions', '표시할 종목': 'ETFs shown', '전체 선택': 'Select all', '전체 해제': 'Clear all',
    '데이터를 불러오는 중…': 'Loading data…', '기간설정': 'Custom', '적용': 'Apply', '종목 설명': 'About the ETFs',
    '같은 지수를 1배·2배·3배로 추종하는 상품끼리 묶었습니다. 레버리지 ETF는': 'ETFs are grouped by the index they track at 1×, 2× and 3×. Leveraged ETFs target 2× or 3× the',
    '하루 수익률': 'daily return',
    '의 2배·3배를 목표로 매일 재조정되므로, 장기 수익률은 지수 수익률의 정확히 2배·3배가 되지 않습니다(변동성이 클수록 손실 쪽으로 벌어짐).': ' and rebalance every day, so long-term returns are not exactly 2× or 3× the index (the gap widens to the downside when volatility is high).',
    'CAGR 계산 방법': 'How CAGR is calculated',
    '— 시작일(MAX는 각 종목의 첫 거래 데이터 — 야후 자료가 상장일보다 며칠 늦게 시작하는 종목이 있음, 그 외 기간은 선택한 시작일 직전 거래일) 종가를 기준으로, 이후 매 거래일 t의 CAGR = (t일 종가 ÷ 기준 종가)':
        '— Starting from the close on the start date (for MAX, each ETF’s first trading day in Yahoo data, which can be a few days after listing; otherwise the last trading day before the chosen start), the CAGR on each later trading day t = (close on t ÷ starting close)',
    '1/경과연수': '1/years elapsed',
    '시작 직후에는 짧은 기간을 1년으로 환산해 값이 크게 출렁이므로, 기간 길이의 1/4(최대 1년, 최소 20일)이 지난 뒤부터 그립니다(5Y 이상은 1년).': 'Right after the start, annualizing a short span makes the line jump around, so it is drawn only after a quarter of the period has passed (max 1 year, min 20 days; 1 year for 5Y and longer).',
    "'분배금 포함'은 분배락일 종가로 분배금을 재투자했다고 가정한 총수익 기준이며, 종가는 주식분할이 반영된 값입니다. 운용보수는 가격에 이미 반영되어 있습니다.": "“With distributions” assumes distributions are reinvested at the ex-date close (total return); prices are split-adjusted. Expense ratios are already reflected in prices.",
    '데이터: Yahoo Finance 일봉 (GitHub Actions로 6시간마다 수집) · 종목 정보: 각 운용사 공식 페이지(Invesco, State Street, iShares, ProShares, Direxion) 기준, 보수는 변경될 수 있음': 'Data: Yahoo Finance daily prices (collected every 6 hours via GitHub Actions) · ETF details from each issuer (Invesco, State Street, iShares, ProShares, Direxion); fees may change.',
    'ETF 12종 CAGR 추이 비교 차트': 'CAGR trend chart for 12 ETFs',
}


def tbl(head, rows, note=None):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    n = f'<p class="g-cap">{note}</p>' if note else ''
    return f'<div class="table-scroll"><table class="g-tbl"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>{n}'


def guide(tab, title, lead, principle, example, faqs):
    q = ''.join(f'<details class="g-faq"><summary>{a}</summary><div class="g-ans">{b}</div></details>' for a, b in faqs)
    return (f'<!-- [GUIDE:{tab}] How it works · worked example · FAQ (English) -->\n'
            f'    <section class="guide" aria-labelledby="g-{tab}-h">\n'
            f'      <h2 id="g-{tab}-h">{title}</h2>\n'
            f'      <p class="g-lead">{lead}</p>\n'
            f'      <div class="g-grid">\n'
            f'        <article class="g-card"><h3>How it works</h3>{principle}</article>\n'
            f'        <article class="g-card"><h3>Worked example</h3>{example}</article>\n'
            f'      </div>\n'
            f'      <div class="g-card g-faqs"><h3>FAQ</h3>{q}</div>\n'
            f'    </section>\n'
            f'    <!-- [/GUIDE:{tab}] -->\n')


def idx_principle(name, base, period):
    return ('<ul class="g-list">'
            '<li><b>CAGR</b> = (current level ÷ starting level)<sup>1/years</sup> − 1, where years = days ÷ 365.25</li>'
            f'<li><b>All time</b>: from {base} to today</li>'
            f'<li><b>Last N years</b>: {period}</li>'
            '<li><b>Monthly / daily rates</b> = (1 + CAGR)<sup>1/12</sup> − 1 and (1 + CAGR)<sup>1/365.25</sup> − 1</li>'
            '<li><b>₩100 million simulation</b> = ₩100M × (1 + CAGR)<sup>years</sup>, assuming the selected period’s CAGR continues</li>'
            f'<li>The {name} is a price index, so dividends are not included.</li></ul>')


def idx_example(rows, note='Calculated from this site’s stored weekly closes (USD).'):
    return tbl(['Item', 'Value'], rows, note)


US_PERIOD = 'from the stored weekly close N years ago to today (built-in start-of-year values if data is missing)'
DIV = lambda n, extra='': ('Does this include dividends?', f'<p>No. The {n} is a <b>price index</b>, so dividends are excluded. Total return with dividends reinvested is higher.{extra}</p>')
SIM = ('Can I rely on the ₩100 million projection?', '<p>It simply assumes the past CAGR of the selected period repeats. Real returns vary a lot from year to year, and taxes, fees and exchange rates are ignored. Compare several period buttons to see how sensitive the result is.</p>')
SRC = ('Where does the data come from?', '<p>The current level comes from Yahoo Finance. Historical values for the “Last N years” buttons come from weekly data that this site collects with GitHub Actions (data/history.json). Press <b>Refresh</b> to reload the current level.</p>')
KRW = ('Why is the simulation in Korean won?', '<p>This site is built for Korean investors, so the simulation starts from ₩100 million (about the size of a typical lump-sum investment in Korea). The growth multiple is the same in any currency: ₩100M growing to ₩3B is the same 30× as $100K growing to $3M. Index growth itself is measured in U.S. dollars.</p>')

GUIDES = {}
GUIDES['sp500'] = guide('sp500', 'How the S&amp;P 500 growth rate is calculated',
    'The S&amp;P 500 tracks 500 large U.S. companies by market value. This page calculates how much the index has grown per year on average (CAGR) from January 3, 1928 (17.66), or over the last 5–30 years, using today’s level.',
    idx_principle('S&amp;P 500', 'January 3, 1928 (17.66)', US_PERIOD),
    idx_example([['Start (1928-01-03)', '17.66'], ['Close on 2024-12-27', '5,970.84 (≈338×)'], ['Years', '96.98'],
                 ['<b>CAGR</b>', '<b>6.19%</b>'], ['10-year CAGR to the same date', '11.07% (from 2,088.77 on 2014-12-26)'], ['Years to double at 6.19%', '≈11.5']]),
    [('Was the S&amp;P 500 always 500 stocks?', '<p>No. It was expanded to 500 companies in 1957; earlier values come from its smaller predecessor index. Long-term studies usually chain them together, but it is worth knowing.</p>'),
     ('What is the easiest way to invest in the S&amp;P 500?', '<p>Through an index ETF such as SPY, VOO or IVV (or a local-market S&amp;P 500 fund). Compare expense ratios, currency hedging and tax treatment. The ETF CAGR comparison page shows SPY’s actual track record.</p>'),
     DIV('S&amp;P 500', ' Dividends make up a meaningful part of long-run S&amp;P 500 returns.'), SIM, KRW])
GUIDES['nasdaq'] = guide('nasdaq', 'How the NASDAQ Composite growth rate is calculated',
    'The NASDAQ Composite includes every common stock listed on Nasdaq and started at 100 in February 1971. This page calculates its average annual growth (CAGR) from the base date or over the last N years, using today’s level.',
    idx_principle('NASDAQ Composite', 'February 8, 1971 (100)', US_PERIOD),
    idx_example([['Base (1971-02-08)', '100'], ['Close on 2024-12-27', '19,722.03 (≈197×)'], ['Years', '53.88'],
                 ['<b>CAGR</b>', '<b>10.30%</b>'], ['10-year CAGR to the same date', '15.16% (from 4,806.86 on 2014-12-26)'], ['Years to double at 10.30%', '≈7.1']]),
    [('How is the Composite different from the Nasdaq-100?', '<p>The Composite holds thousands of Nasdaq-listed stocks; the Nasdaq-100 holds only the 100 largest non-financial ones. Popular ETFs such as QQQ track the Nasdaq-100, so use that page to compare with ETF returns.</p>'),
     ('Does the exchange rate matter for non-U.S. investors?', '<p>Yes. These growth rates are in U.S. dollars. If you invest from another currency, a stronger dollar adds to your return and a weaker dollar subtracts from it.</p>'),
     DIV('NASDAQ Composite'), SIM, SRC])
GUIDES['nasdaq100'] = guide('nasdaq100', 'How the Nasdaq-100 growth rate is calculated',
    'The Nasdaq-100 tracks the 100 largest non-financial companies on Nasdaq and started at 250 on January 31, 1985. It is the index behind QQQ and TQQQ. This page calculates its average annual growth (CAGR).',
    idx_principle('Nasdaq-100', 'January 31, 1985 (250)', US_PERIOD),
    idx_example([['Base (1985-01-31)', '250'], ['Close on 2024-12-27', '21,473.02 (≈86×)'], ['Years', '39.90'],
                 ['<b>CAGR</b>', '<b>11.81%</b>'], ['10-year CAGR to the same date', '17.40% (from 4,314.09 on 2014-12-26)'], ['Years to double at 11.81%', '≈6.2']]),
    [('Does a 3× ETF like TQQQ grow at 3× this rate?', '<p>No. Leveraged ETFs target 3× the <b>daily</b> return, so over long periods volatility makes results diverge sharply from a simple 3×. In choppy markets a leveraged ETF can lose money even if the index ends flat. Compare QQQ and TQQQ on the ETF CAGR comparison page.</p>'),
     ('Does the exchange rate matter for non-U.S. investors?', '<p>Yes. These rates are in U.S. dollars; currency moves add to or subtract from returns in your home currency.</p>'),
     DIV('Nasdaq-100'), SIM, SRC])
GUIDES['dowjones'] = guide('dowjones', 'How the Dow Jones growth rate is calculated',
    'The Dow Jones Industrial Average started at 40.94 on May 26, 1896 and is calculated from the share prices of 30 U.S. blue chips. This page calculates its average annual growth over more than 120 years or over the last N years.',
    idx_principle('Dow Jones Industrial Average', 'May 26, 1896 (40.94)', US_PERIOD),
    idx_example([['Start (1896-05-26)', '40.94'], ['Close on 2024-12-27', '42,992.21 (≈1,050×)'], ['Years', '128.59'],
                 ['<b>CAGR</b>', '<b>5.56%</b>'], ['10-year CAGR to the same date', '9.06% (from 18,053.71 on 2014-12-26)'], ['Years to double at 5.56%', '≈12.8']]),
    [('How is the Dow different from the S&amp;P 500?', '<p>The Dow adds up the <b>share prices</b> of 30 stocks (price-weighted), so high-priced stocks matter most. The S&amp;P 500 weights 500 stocks by <b>market value</b>. Different methods and breadth lead to different long-term growth rates.</p>'),
     ('Is 5.56% a year over 128 years a lot?', '<p>Even without dividends it turned 40.94 into about 43,000 — roughly 1,050× — through compounding. With dividends reinvested the result would be far larger. Along the way there were drawdowns, such as the Great Depression, that took decades to recover.</p>'),
     DIV('Dow Jones Industrial Average'), SIM, SRC])
GUIDES['sox'] = guide('sox', 'How the PHLX Semiconductor Index (SOX) growth rate is calculated',
    'The SOX tracks 30 U.S.-listed semiconductor companies and started at 200 on December 1, 1993. Because the chip cycle is volatile, comparing growth across different periods matters.',
    idx_principle('PHLX Semiconductor Index', 'December 1, 1993 (200)', 'from the stored weekly close N years ago to today'),
    idx_example([['Base (1993-12-01)', '200'], ['Close on 2024-12-27', '5,122.97 (≈26×)'], ['Years', '31.07'],
                 ['<b>CAGR</b>', '<b>11.00%</b>'], ['10-year CAGR to the same date', '22.07% (from 697.00 on 2014-12-26)'], ['Years to double at 11.00%', '≈6.6']]),
    [('Why is the last 10 years so much higher than all time?', '<p>Chip stocks crashed in the 2000 dot-com bust and the 2008 financial crisis, then surged over the last decade on data-center and AI demand. In the example, all-time CAGR is 11.00% while the last 10 years is 22.07%. Highly cyclical sectors are very sensitive to the starting point.</p>'),
     ('How is SOX different from the Dow Jones U.S. Semiconductors Index?', '<p>Both track U.S. chip companies, but they differ in publisher, inclusion rules and number of stocks. SOX is calculated by Nasdaq from 30 companies; DJUSSC is published by S&amp;P Dow Jones Indices. Semiconductor ETFs track different indices, so check the benchmark before investing.</p>'),
     DIV('PHLX Semiconductor Index'), SIM, SRC])
GUIDES['djsemi'] = guide('djsemi', 'How the Dow Jones U.S. Semiconductors Index growth rate is calculated',
    'The Dow Jones U.S. Semiconductors Index (DJUSSC) measures U.S.-listed chip companies. Its official base date and value are not readily available, so “All time” on this page starts from the first date in this site’s data (February 2000).',
    idx_principle('Dow Jones U.S. Semiconductors Index', 'the first stored data point (week of 2000-02-13, 2,838.2)', 'from the stored weekly value N years ago to today (history from CNBC weekly data)'),
    idx_example([['Start (week of 2000-02-13)', '2,838.2'], ['Close on 2024-12-27', '20,216.88 (≈7.1×)'], ['Years', '24.87'],
                 ['<b>CAGR</b>', '<b>8.21%</b>'], ['10-year CAGR to the same date', '26.19% (from 1,972.91 in Dec 2014)'], ['Years to double at 8.21%', '≈8.8']],
                'Calculated from this site’s stored weekly data (USD). Early 2000 was near the dot-com peak, which pulls the all-time rate down.'),
    [('Why does “All time” start in 2000?', '<p>The index’s base date and value are hard to verify, and free historical data starts in February 2000. Because that was near the dot-com peak, the all-time CAGR (8.21%) is far below the last 10 years (26.19%).</p>'),
     ('Do leveraged chip ETFs grow at 2× or 3× this rate?', '<p>No. They target 2× or 3× the <b>daily</b> return, so long-run results can be well below or above a simple multiple depending on volatility. See the ETF CAGR comparison page for real results.</p>'),
     DIV('Dow Jones U.S. Semiconductors Index'), SIM,
     ('Where does the data come from?', '<p>The current level comes from Yahoo Finance. Because Yahoo does not provide its history, past values come from CNBC weekly data collected with GitHub Actions (data/history.json).</p>')])
GUIDES['compound'] = guide('compound', 'How compound interest is calculated',
    'Compound interest earns interest on interest. The longer the term, the more the interest on past interest outgrows the principal itself. This calculator follows the money month by month.',
    '<ul class="g-list">'
    '<li><b>Lump sum</b>: final balance = principal × (1 + rate ÷ n)<sup>n × years</sup>, where n is the number of compounding periods per year</li>'
    '<li><b>Monthly contributions</b>: deposits are added at the end of each month and earn interest from the next month. Between compounding dates, interest accrues and is added to the balance on each compounding date.</li>'
    '<li><b>Tax</b>: applied only to the interest each time it is credited (Korea’s interest tax is 15.4%).</li>'
    '<li><b>Effective CAGR</b>: (final ÷ principal)<sup>1/years</sup> − 1 for a lump sum; with contributions, the annualized internal rate of return (IRR) that accounts for when each deposit was made.</li></ul>',
    tbl(['Scenario (7% a year)', 'Final balance', 'Total paid in'], [
        ['₩100M · 5 years · annual', '₩140.26M', '₩100M'], ['₩100M · 20 years · annual', '₩386.97M', '₩100M'],
        ['₩100M · 20 years · monthly', '₩403.87M', '₩100M'], ['₩100M · 20 years · annual · 15.4% tax', '₩316.03M', '₩100M'],
        ['₩100M + ₩1M a month · 20 years · annual', '₩894.70M', '₩340M']],
        'Rows without tax are pre-tax. In the 5-year case, annual interest grows from ₩7.00M to ₩7.49M, ₩8.01M … as interest compounds. The same math works in any currency.'),
    [('How long does it take to double my money?', '<p>Divide 72 by the annual rate (the Rule of 72). At 7% that is 72 ÷ 7 ≈ 10.3 years; the exact figure is ln 2 ÷ ln 1.07 = 10.2 years. The CAGR calculator shows exact doubling and 10× times.</p>'),
     ('How much more does more frequent compounding pay?', '<p>At 7% for 20 years, ₩100M grows to ₩386.97M with annual compounding and ₩403.87M with monthly compounding — about 4% more — because interest joins the principal sooner.</p>'),
     ('How much does tax reduce the effective return?', '<p>With Korea’s 15.4% interest tax, a 7% product compounds at about 5.92% a year, and the 20-year balance falls from ₩386.97M to ₩316.03M. Tax-advantaged accounts narrow this gap.</p>'),
     ('Why does the effective CAGR equal the rate with monthly contributions?', '<p>Dividing the final balance by total deposits ignores that later deposits were invested for less time. This calculator uses an IRR that accounts for every deposit date, so with annual compounding and no tax it matches the rate you entered.</p>'),
     ('Can I use this for stock investing?', '<p>You can plug in a long-term average return to get a rough idea, but stock returns vary a lot from year to year, and the order of returns matters. See the S&amp;P 500 and Nasdaq growth pages for historical index growth.</p>')])
GUIDES['cagr'] = guide('cagr', 'How CAGR (compound annual growth rate) is calculated',
    'CAGR is the constant yearly growth rate that turns a starting value into an ending value. It ignores the ups and downs in between, which makes it a fair way to compare funds, indices and company results over different periods.',
    '<ul class="g-list">'
    '<li><b>CAGR</b> = (ending value ÷ starting value)<sup>1/years</sup> − 1</li>'
    '<li>With dates, years = days ÷ 365.25 (fractional years included).</li>'
    '<li><b>Average monthly growth</b> = (1 + CAGR)<sup>1/12</sup> − 1</li>'
    '<li><b>Years to 2× and 10×</b> = ln 2 ÷ ln(1 + CAGR) and ln 10 ÷ ln(1 + CAGR)</li>'
    '<li><b>Reverse mode</b>: required ending value = starting value × (1 + target CAGR)<sup>years</sup></li></ul>',
    tbl(['Item', 'Result'], [
        ['100M → 180M over 5 years', '<b>CAGR 12.47%</b>'], ['Total return', '+80.00%'], ['Average monthly growth', '+0.9845%'],
        ['Years to 2× / 10×', '5.9 / 19.6'], ['Ending value needed at 10% for 5 years', '161.05M'], ['Years to reach 180M at 10%', '6.2']],
        'The answer is 12.47%, not 80% ÷ 5 = 16%, because each year’s gain is earned on a larger balance.'),
    [('How is CAGR different from the average return?', '<p>If ₩100M gains 50% and then loses 50%, the arithmetic average is 0%, but you end with ₩75M. CAGR = (0.75)<sup>1/2</sup> − 1 = <b>−13.4%</b>, which matches what actually happened. That is why long-term performance is compared with CAGR.</p>'),
     ('What if I added money along the way?', '<p>CAGR uses only the start and end values, so deposits or withdrawals distort it. For regular contributions, use the compound interest calculator with monthly contributions, which reports an IRR-based effective return.</p>'),
     ('Why does the Rule of 72 give a slightly different answer?', '<p>72 ÷ 12.47 ≈ 5.8 years is a quick estimate; the calculator uses logarithms and shows 5.9 years. The rule works best for rates around 6–10%.</p>'),
     ('Can CAGR be negative?', '<p>Yes. If the ending value is below the starting value, CAGR is negative and the doubling times are not shown.</p>'),
     ('Can I see the CAGR of stock indices?', '<p>Yes. The S&amp;P 500, Nasdaq, Dow and semiconductor index pages calculate CAGR from each index’s base date to today, along with recent 5–30 year periods.</p>')])

GUIDES['fear'] = guide('fear', 'How to read the Fear &amp; Greed Index',
    'The Fear &amp; Greed Index is CNN’s single score for U.S. stock-market sentiment, from <b>0 (extreme fear) to 100 (extreme greed)</b>. It shows at a glance whether investors are unusually scared or euphoric.',
    '<ul class="g-list"><li>Each of the <b>seven indicators</b> above (momentum, 52-week highs vs lows, breadth, put/call ratio, VIX, safe-haven demand, junk-bond demand) is scored 0–100 against its usual range.</li>'
    '<li>The index is the <b>equal-weighted average</b> of the seven scores.</li>'
    '<li>This page pulls CNN’s data every <b>15 minutes</b> and shows the current value, the values a day, week, month and year ago, and the last 90 days.</li></ul>',
    tbl(['Score', 'Zone', 'Common reading'], [['0–25', 'Extreme fear', 'Panic selling; contrarians start paying attention'], ['25–45', 'Fear', 'Risk-off mood'],
        ['45–55', 'Neutral', 'No strong tilt'], ['55–75', 'Greed', 'Risk-on mood'], ['75–100', 'Extreme greed', 'Overheating; beware of chasing']],
        'Zone boundaries follow this site’s display; readings are for reference only.'),
    [('Should I buy when the score is low?', '<p>It is widely used as a contrarian gauge, but it is not a timing signal. Extreme fear has lasted for weeks at times, so use it only as an input to a gradual buying plan.</p>'),
     ('Does it apply to Korean stocks?', '<p>No. All seven indicators are U.S. market data, so the mood of the KOSPI can differ. It is most useful when investing in U.S. stocks and ETFs.</p>'),
     ('Why compare with a day, week, month and year ago?', '<p>The direction often matters more than the level. A score of 20 that rose from 10 a week ago means fear is easing; one that fell from 40 means fear is growing.</p>'),
     ('How often does it change?', '<p>The indicators use intraday prices, so the score moves while U.S. markets are open. This page fetches new values every 15 minutes and rechecks every 5 minutes while it is open.</p>'),
     ('Where does the data come from?', '<p>CNN Business’s Fear &amp; Greed Index. This site only displays the values; CNN defines the method.</p>')])

GUIDES['etfcagr'] = guide('etfcagr', 'How the ETF CAGR comparison is calculated',
    'This chart compares how the <b>compound annual growth rate (CAGR)</b> of 12 U.S. ETFs tracking the same indices at 1×, 2× and 3× changes over time. Use it to check whether leveraged ETFs really deliver 2× or 3× over the long run.',
    '<ul class="g-list"><li><b>CAGR</b> on each trading day t = (close on t ÷ base close)<sup>1/years elapsed</sup> − 1</li>'
    '<li><b>With distributions</b>: total return assuming distributions are reinvested at the ex-date close</li>'
    '<li>Very short periods annualize wildly, so each line starts after a quarter of the selected period (max 1 year, min 20 days).</li>'
    '<li>Leveraged ETFs rebalance every day to target 2× or 3× of the <b>daily</b> return.</li></ul>',
    tbl(['Index move', '1×', '2×', '3×'], [['Day 1: +10%', '110', '120', '130'], ['Day 2: −10%', '99', '96', '91'], ['Two-day return', '−1%', '−4%', '−9%']],
        'Starting from 100. The index fell 1%, but the 3× ETF fell 9%, not 3%. The bigger the swings, the more this volatility drag accumulates. CAGR example: 100 growing to 250 in 10 years is 2.5<sup>1/10</sup> − 1 = <b>9.6% a year</b>.'),
    [('Do leveraged ETFs return exactly 2× or 3× over the long run?', '<p>No. Because they rebalance daily, long-run returns are not an exact multiple of the index. They fall well short in choppy markets and can exceed the multiple in steady uptrends.</p>'),
     ('What is the difference between “Price” and “With distributions”?', '<p>Price shows price change only; with distributions assumes payouts are reinvested. Leveraged ETFs pay little, so the gap is small, while for dividend payers like SPY the gap compounds every year.</p>'),
     ('Why do the period buttons (5Y, 10Y, 15Y, MAX) change the result so much?', '<p>CAGR depends heavily on whether the start date is just after a crash or at a peak. Look at several periods to make sure one lucky window is not driving the result.</p>'),
     ('Are expense ratios included?', '<p>Yes. Fees are deducted from the ETF price every day, so CAGR based on closing prices already reflects them.</p>'),
     ('How often is the data updated?', '<p>Yahoo Finance daily prices are collected every 6 hours. Closes are adjusted for stock splits.</p>')])

GUIDES['muhan'] = guide('muhan', 'How the Infinite Buying order sheet is calculated',
    'Infinite Buying (<span lang="ko" translate="no">무한매수법</span>) is a rule-based way to trade 3× leveraged ETFs such as TQQQ and SOXL, created by the Korean investor <b>Laoer</b>: split your capital into 20–40 portions, buy a little every day with limit-on-close orders, and sell in parts once the price is a set % above your average cost. Record your fills and this tracker calculates the T value, average cost and star price, and builds the order sheet to place today.',
    '<ul class="g-list"><li><b>Daily buy amount</b> = remaining cash ÷ (splits − T)</li>'
    '<li><b>T value</b>: full buy +1, half buy +0.5, quarter sell ×0.75, target-price sell ×0.25 — how many portions you have bought.</li>'
    '<li><b>Star %</b> = target − target × 2 ÷ splits × T (default target: TQQQ 15%, SOXL 20%)</li>'
    '<li><b>Star price</b> = average cost × (1 + star %) — buy one tick below it, quarter-sell LOC at it.</li>'
    '<li><b>First half</b> (T &lt; half the splits): half the daily amount at the star price, half at the average cost (LOC) · <b>second half</b>: all at the star price</li>'
    '<li><b>Sells</b>: ¼ of the shares LOC at the star price, the other ¾ as a limit order at average × (1 + target %)</li>'
    '<li><b>Exhausted → reverse mode</b>: once T exceeds splits − 1, the order sheet switches to Laoer’s reverse-mode rules.</li></ul>',
    tbl(['Item', 'Value'], [['Setup', 'TQQQ · $10,000 · 20 splits · 15% target'], ['Fills', '10 shares at $50, five times (T = 5)'], ['Average cost · cash', '$50.00 · $7,500'],
        ['Daily buy amount', '$7,500 ÷ (20 − 5) = $500'], ['Star % · star price', '15 − 15 × 2 ÷ 20 × 5 = 7.5% · $53.75'],
        ['Today’s buys (first half)', 'LOC $53.74 × 4 + LOC $50.00 × 6'], ['Today’s sells', 'Quarter LOC $53.75 × 12 + 15% limit $57.50 × 38']],
        'Below the buys come lower 1-share LOC lines at $45.45, $41.66 … (daily amount ÷ (shares + 1, + 2 …)). The first buy is placed LOC at the previous close × 1.12 (the “big-number” price).'),
    [('Who created Infinite Buying?', '<p>Infinite Buying (<span lang="ko" translate="no">무한매수법</span>) was created by <b>Laoer</b> (<span lang="ko" translate="no">라오어</span>, a pen name). The official rules and revisions are published in Korean on Laoer’s <a href="https://cafe.naver.com/infinitebuying" target="_blank" rel="noopener">Naver Cafe</a> and in the book <i>Laoer’s U.S. Stock Infinite Buying</i> (Alki, 2021). This page is an independent tool that calculates and records orders with the V4.0 rules; if the rules change, the cafe announcements take precedence.</p>'),
     ('What is an LOC order?', '<p>A limit-on-close (LOC) order fills at the closing price if the close is <b>at or below (buy) / at or above (sell)</b> your price. Infinite Buying trades once a day on the close, so it relies on LOC orders offered by U.S. brokers.</p>'),
     ('Why is the T value a decimal?', '<p>A half fill adds only 0.5, and a quarter sell multiplies T by 0.75. A low T means a high star %, so buy and sell thresholds are higher; a high T (more bought) lowers them so you buy cheaper and exit sooner.</p>'),
     ('Did Infinite Buying beat buy and hold in the past?', '<p>Not on return. In the real-data backtest in chapter 3-6 (TQQQ and SOXL since 2010, 27 settings, recalculated daily) the default settings earned less per year than simply holding, but with much shallower maximum drawdowns. See the live table above for current numbers.</p>'),
     ('Where are my records stored?', '<p>If you <b>sign in</b>, all records are saved to your account automatically and follow you to any phone or PC. Without signing in they stay only in this browser (localStorage) and are uploaded to your account when you sign in later.</p>'),
     ('Can Infinite Buying lose money?', '<p>Yes. TQQQ and SOXL track 3× the daily return, so a long decline can shrink your capital sharply, and if the market does not recover after the cash is used up, losses are realised. This page helps you calculate and record orders under the method; investment decisions are your own responsibility.</p>')])

TEXT.update({w: w for w in ['＋ 오늘 기록하기', '오늘 주문 다 넣었어요', '중간 진입', '무한매수법', '라오어', '큰수']})   # 영어판에 일부러 남기는 한국어 원어 (translate="no")
GUIDEBOOKS = {'muhan': open(os.path.join(os.path.dirname(OUT), 'muhan_guidebook_en.html'), encoding='utf-8').read()}

json.dump({'text': TEXT, 'guides': GUIDES, 'guidebooks': GUIDEBOOKS}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('저장', OUT, len(TEXT), '개 문구 ·', len(GUIDES), '개 설명글')
