# 텍스트 던전 밸런스 시스템 명세 (2026-02-06)

## 1) 목표
- 난이도별 체감 차이를 유지하면서도, "억까"와 "스노우볼 붕괴"를 동시에 줄인다.
- 전투/성장/경제/리스크(함정/이벤트/NPC) 수치를 단일 엔진(`src/lib/balancing.ts`)에서 관리한다.
- 카드 데이터의 보상 의도가 런타임에서 손실되지 않도록 정규화 파이프라인을 보강한다.

## 2) 이번 패치에서 실제 구현된 항목
- 전투 공식 통합
  - 피해: `calcDamage(atk, def, mul, reduction)`
  - 치명타: `calcCritChance(luk)`
  - 도주: `calcFleeChance(heroSpd, enemySpd)`
  - 상태이상 저항: `calcStatusResistChance(luk)`
- 성장 공식 통합
  - 레벨업 필요 XP: `xpToNext(level)`
  - 카드 경험치: `xpFromCard(card, difficulty, progress)`
- 경제/보상 통합
  - 골드/아이템 보상 해석: `goldFromReward`, `itemsFromReward`
  - 기본 보상/드랍 확률: `getFallbackRewardGold`, `getGearDropChance`, `getFallbackConsumableDropChance`
  - 상점/대장간/NPC/퀘스트/이벤트 수치 프로파일 함수화
- 런타임 반영
  - `PlayClient`의 난이도 하드코딩 분기 제거 후 프로파일 호출로 교체
- 안정화
  - `normalizeCard.ts`에서 `{id, rate}` 형태의 확률형 아이템 보상이 누락되던 문제 수정

## 3) 난이도별 핵심 수치 (현재 적용값)

### 3-1. 경제/진행
- 시작 골드: EASY 110 / NORMAL 150 / HARD 205 / NIGHTMARE 270
- 클리어 정산: EASY 70 / NORMAL 100 / HARD 145 / NIGHTMARE 205
- 실패 위로금: EASY 20 / NORMAL 26 / HARD 36 / NIGHTMARE 50
- 대장간 강화 비용: EASY 75 / NORMAL 110 / HARD 145 / NIGHTMARE 195

### 3-2. 함정/리스크
- 함정 발동률: EASY 0.28 / NORMAL 0.46 / HARD 0.63 / NIGHTMARE 0.79
- 함정 피해 비율(기본): EASY 0.08 / NORMAL 0.12 / HARD 0.16 / NIGHTMARE 0.22
- 제단 시간 페널티 기본치: EASY 28 / NORMAL 50 / HARD 72 / NIGHTMARE 108

### 3-3. 전투 밀도
- 스쿼드 몬스터 수: EASY 2 / NORMAL 3 / HARD 3 / NIGHTMARE 4

### 3-4. 이벤트 판정
- EASY: DC 11, 성공 +30G, 실패 HP -5%
- NORMAL: DC 14, 성공 +45G, 실패 HP -8%
- HARD: DC 17, 성공 +63G, 실패 HP -11%
- NIGHTMARE: DC 20, 성공 +86G, 실패 HP -15%

### 3-5. NPC 대화
- EASY: XP 11 / Gold 10 / 정보 20G / 위협 DC 12 / 성공 42G / 실패 HP -6.5%
- NORMAL: XP 15 / Gold 14 / 정보 28G / 위협 DC 14 / 성공 58G / 실패 HP -9%
- HARD: XP 20 / Gold 20 / 정보 36G / 위협 DC 16 / 성공 82G / 실패 HP -11%
- NIGHTMARE: XP 27 / Gold 26 / 정보 46G / 위협 DC 18 / 성공 114G / 실패 HP -14%

### 3-6. NPC 퀘스트
- 기본 보상 골드: EASY 95 / NORMAL 125 / HARD 160 / NIGHTMARE 230
- 처치 의뢰 목표: EASY 2 / NORMAL 3 / HARD 4 / NIGHTMARE 5
- 보상 배수: 상자 0.9 / 처치 1.1 / 도달 1.4

### 3-7. 상인 기본가
- EASY: 포션 30 / 도구 55 / 연막 75 / 장비 95
- NORMAL: 포션 36 / 도구 68 / 연막 94 / 장비 128
- HARD: 포션 44 / 도구 82 / 연막 116 / 장비 176
- NIGHTMARE: 포션 56 / 도구 104 / 연막 146 / 장비 238

## 4) 핵심 공식

### 4-1. 피해
- `raw = atk * mul - def * 0.45`
- `pre = max(1, round(raw))`
- `dmg = round(pre * clamp(reduction, 0, 2))`

### 4-2. 치명타
- `crit = clamp(0.04 + (luk - 10) * 0.0045, 0.04, 0.30)`

### 4-3. 도주
- `flee = clamp(0.32 + (heroSpd - enemySpd) * 0.019, 0.12, 0.82)`

### 4-4. 상태이상 저항
- `resist = clamp(0.06 + (luk - 10) * 0.009, 0.02, 0.38)`

### 4-5. 레벨업 곡선
- `xpToNext(level) = round(60 + t*28 + t*t*2.4)` (`t = level - 1`)

### 4-6. 전투 카드 XP
- `xp = baseByDifficulty * gradeMultiplier * progressMultiplier`
- 진행 배수: `0.94 -> 1.20` 선형 보간 (초반 과성장 억제, 후반 보상 회복)

### 4-7. 드랍
- 장비 드랍: 난이도/소스(COMBAT/CHEST/BOSS)/진행도/보유장비수에 따라 확률 산출
- 보조 소모품 드랍: 기본 확률 + 진행 보정

## 5) 안정화 관점에서 본 이번 변경의 의미
- 수치 단일화: `PlayClient` 내부 분산 상수 제거로 유지보수 리스크 감소
- 리그레션 방지: 보상 공식 변경 시 한 파일만 조정하면 전체 반영
- 데이터-런타임 정합성: 확률형 아이템 보상이 정규화 단계에서 소실되지 않음

## 6) 완벽 밸런스를 위한 다음 측정 지표 (권장)
- 난이도별 클리어율(E/N/H/NM)
- 방당 평균 체력 손실, 평균 획득 골드, 평균 레벨업 횟수
- 함정 사망 비중 / NPC 상호작용 선택률 / 도주 시도 성공률
- 전투 길이(턴 수)와 승패 상관관계

## 7) 다음 튜닝 우선순위
1. 클래스별(워리어/로그/메이지/레인저/클레릭) 승률 편차 보정
2. 장비 희귀도별 기대가치(EV) 표준화
3. 카드 생성기(`normalizeCard`)의 전투 통계 캡과 실제 런타임 TTK(Time To Kill) 재정렬
