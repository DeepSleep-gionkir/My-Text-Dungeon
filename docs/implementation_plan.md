# AI Text Dungeon - 상세 구현 계획

> **목표**: 사용자가 AI와 대화하여 던전을 만들고, 다른 사용자가 플레이하는 UGC 텍스트 로그라이트 RPG

---

## Phase 0: 프로젝트 기반 (완료)

- [x] Next.js + Tailwind 초기화
- [x] Firebase 설정 ([firebase.ts](file:///Users/silvermaster/MY%20TEXT%20DUNGEON/src/lib/firebase.ts))
- [x] Gemini API 연동 ([gemini.ts](file:///Users/silvermaster/MY%20TEXT%20DUNGEON/src/lib/gemini.ts))
- [x] 상태 관리 스토어 ([useUserStore.ts](file:///Users/silvermaster/MY%20TEXT%20DUNGEON/src/store/useUserStore.ts))
- [x] 글로벌 스타일 및 폰트 (Cinzel, Noto Serif KR)
- [x] 로그인 페이지 (Great Gate)
- [x] 메인 로비 (Dashboard)

---

## Phase 1: 던전 빌더 - 기본 UI (진행 중)

### 1.1 카드 시스템 기초
- [x] 카드 타입 정의 ([types/card.ts](file:///Users/silvermaster/MY%20TEXT%20DUNGEON/src/types/card.ts))
- [x] CardView 컴포넌트 (시각화)
- [ ] CardDetailModal (상세 정보 팝업)
- [ ] 카드 등급별 스타일링 (Normal/Elite/Boss/Epic/Legendary)

### 1.2 채팅 인터페이스
- [x] ChatInterface 기본 UI
- [x] 시스템 프롬프트 ([prompts.ts](file:///Users/silvermaster/MY%20TEXT%20DUNGEON/src/lib/prompts.ts))
- [ ] 카테고리 선택 UI (몬스터/함정/보물/제단/NPC/휴식)
- [ ] 세부 유형 선택 UI (Squad vs Single, Instant vs Room 등)
- [ ] 난이도 선택 UI (Easy/Normal/Hard/Nightmare)

### 1.3 빌더 페이지 레이아웃
- [x] 기본 레이아웃 (채팅 + 그리드 + 덱)
- [ ] 던전 그리드 드래그 앤 드롭
- [ ] 카드 덱 스크롤 및 정렬
- [ ] 슬롯 인디케이터 (3/20 표시)

---

## Phase 2: 던전 빌더 - 고급 기능

### 2.1 AI 연동 강화
- [ ] Gemini API 응답 파싱 및 에러 핸들링
- [ ] JSON 스키마 검증 (Zod 또는 직접 검증)
- [ ] 생성 실패 시 재시도 로직
- [ ] 속도 제한 대응 (Rate Limiting)

### 2.2 카드 편집 기능
- [ ] 생성된 카드 수동 편집 모달
- [ ] 카드 재생성 (Reroll) 버튼
- [ ] 카드 삭제 기능
- [ ] 카드 복제 기능

### 2.3 던전 저장 및 게시
- [ ] Firestore에 카드 저장
- [ ] 던전 메타데이터 입력 (이름, 설명, 태그)
- [ ] 던전 유효성 검증 (모든 슬롯 채움)
- [ ] 던전 게시 API

---

## Phase 3: 던전 탐색 (Explore)

### 3.1 던전 목록 페이지
- [ ] `/explore` 페이지 생성
- [ ] Firestore에서 던전 목록 조회
- [ ] 던전 카드 컴포넌트 (제목, 태그, 난이도, 클리어율)
- [ ] 필터링 (난이도, 최신순, 인기순)
- [ ] 검색 기능

### 3.2 던전 상세 페이지
- [ ] `/explore/[dungeonId]` 페이지
- [ ] 던전 정보 표시
- [ ] 클리어 통계, 리뷰
- [ ] [도전하기] 버튼

---

## Phase 4: 게임플레이 엔진 - 기본

### 4.1 게임 상태 관리
- [ ] `useGameStore.ts` (전투 상태, 현재 방, 플레이어 상태)
- [ ] 게임 초기화 로직 (던전 로드, 플레이어 생성)
- [ ] 방 이동 시스템

### 4.2 플레이 화면 레이아웃
- [ ] `/play/[dungeonId]` 페이지
- [ ] 상단: 진행 상황 (Room X / Y)
- [ ] 중앙: 인카운터 카드 표시
- [ ] 하단 좌측: 전투 로그
- [ ] 하단 우측: 액션 버튼

### 4.3 카드 인카운터 처리
- [ ] 몬스터 카드 조우 → 전투 시작
- [ ] 함정 카드 조우 → 스탯 체크
- [ ] 보물 카드 조우 → 획득/미믹 판정
- [ ] 제단 카드 조우 → 선택지 표시
- [ ] NPC 카드 조우 → 대화/거래
- [ ] 휴식 카드 조우 → 회복 선택

---

## Phase 5: 게임플레이 엔진 - 전투

### 5.1 전투 시스템 기초
- [ ] 턴 순서 계산 (SPD 기반)
- [ ] 데미지 공식 구현
- [ ] 속성 상성 계산 (ATTR_FIRE vs ATTR_ICE 등)
- [ ] 명중/회피 판정

### 5.2 상태이상 시스템
- [ ] 상태이상 타입 정의 (STATUS_BURN, STATUS_POISON 등)
- [ ] 상태이상 적용/해제 로직
- [ ] 턴 시작/종료 시 상태이상 처리
- [ ] 상태이상 아이콘 표시

### 5.3 스킬 시스템
- [ ] 플레이어 스킬 정의
- [ ] 스킬 쿨타임 관리
- [ ] 스킬 버튼 UI
- [ ] 몬스터 행동 패턴 실행 (actions 배열 처리)

### 5.4 전투 UI 연출
- [ ] 공격 애니메이션 (흔들림, 번쩍임)
- [ ] 피해량 팝업 텍스트
- [ ] 치명타 연출
- [ ] 사망 연출 (Dissolve 효과)

---

## Phase 6: 게임플레이 엔진 - 결과

### 6.1 전투 종료 처리
- [ ] 승리 시 보상 표시
- [ ] 경험치 획득 및 레벨업
- [ ] 아이템 획득
- [ ] 다음 방으로 이동

### 6.2 던전 클리어/실패
- [ ] 보스 처치 → 클리어 화면
- [ ] 클리어 보상 계산 (Gold, Essence)
- [ ] 사망 → 실패 화면
- [ ] 결과 Firestore 저장

---

## Phase 7: 영웅 시스템

### 7.1 영웅 페이지 기본
- [ ] `/hero` 페이지
- [ ] 현재 스탯 표시 (레이더 차트)
- [ ] 장착 유물(Perk) 표시

### 7.2 직업 선택
- [ ] 직업 카드 UI (Warrior, Rogue, Mage, Ranger, Cleric, Warlock)
- [ ] 카드 뒤집기 애니메이션
- [ ] 직업별 고유 특성 표시
- [ ] 직업 해금 시스템

### 7.3 메타 성장
- [ ] 골드로 기초 스탯 강화
- [ ] 강화 비용 계산
- [ ] 강화 UI

---

## Phase 8: 부가 기능

### 8.1 사운드
- [ ] 버튼 클릭 효과음
- [ ] 전투 효과음 (타격, 회피)
- [ ] 배경 음악 (로비, 전투)
- [ ] 음량 설정

### 8.2 모바일 최적화
- [ ] 반응형 레이아웃 점검
- [ ] 터치 드래그 앤 드롭
- [ ] 가상 키보드 대응

### 8.3 소셜 기능
- [ ] 던전 좋아요
- [ ] 클리어 랭킹
- [ ] 알림 시스템 ("누군가 당신의 던전에서 사망했습니다")

---

## 현재 진행 상황

| Phase | 상태 | 완료율 |
|-------|------|--------|
| Phase 0 | 완료 | 100% |
| Phase 1 | 진행 중 | 50% |
| Phase 2 | 대기 | 0% |
| Phase 3 | 대기 | 0% |
| Phase 4 | 대기 | 0% |
| Phase 5 | 대기 | 0% |
| Phase 6 | 대기 | 0% |
| Phase 7 | 대기 | 0% |
| Phase 8 | 대기 | 0% |
