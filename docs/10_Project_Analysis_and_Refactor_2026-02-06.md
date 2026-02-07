# 프로젝트 전체 분석 및 리팩토링 기록 (2026-02-06)

## 1) 프로젝트 개요
- 프로젝트 성격: AI 기반 텍스트 던전 로그라이크(던전 제작 + 탐험 + 영웅 성장)
- 프레임워크: Next.js App Router + React + TypeScript
- 데이터/인증: Firebase(Auth, Firestore), Firebase Admin(Server)
- 클라이언트 상태: Zustand
- 핵심 플레이 파일: `src/app/(app)/play/[dungeonId]/PlayClient.tsx` (대규모 전투/이벤트 로직)

## 2) 구조 분석 결과
### 강점
- 서버/클라이언트 분리가 명확하며 SSR로 초기 데이터를 안전하게 주입함.
- 카드/영웅/빌더 타입이 별도 `types`로 관리되어 도메인 경계가 비교적 분명함.
- 던전 빌더와 플레이 루프가 실제 게임 체험으로 연결되어 제품 코어가 살아 있음.

### 리스크
- 대형 컴포넌트(`PlayClient`, `BuilderClient`)에 로직이 집중되어 유지보수 난이도가 높음.
- AI 응답 파싱 구간에서 동적 타입 처리(`any`)가 많아 런타임 안전성이 약했음.
- 난이도/보상/함정 확률 상수가 플레이 코드 내부에 분산되어 밸런스 조정 비용이 큼.
- 일부 React 최신 규칙(Effect/setState, 렌더 시 동적 컴포넌트 생성) 위반이 존재했음.

## 3) 이번 작업에서 적용한 안정화/리팩토링
### 정적 안정화(린트/타입)
- `any` 제거 및 안전 파싱 유틸 도입
  - 대상: `BuilderClient`, `PlayClient`, `my-dungeons/page`
- React 규칙 위반 해결
  - `ExplorePage`의 try/catch 내부 JSX 반환 패턴 제거
  - `CardCategoryIcon`의 render-time dynamic component 생성 제거
  - `DungeonSetupModal`의 동기 `setState in effect` 제거
- 불필요 경고 제거
  - 미사용 변수/표현식 정리, 빌드 타입 오류 수정

### 도메인 리팩토링
- 난이도 밸런스 상수 통합
  - 파일: `src/lib/balancing.ts`
  - 통합 항목:
    - 시작 골드
    - 클리어/실패 보상
    - 함정 발동률
    - 제단 수호자 스탯
    - 난이도 설명 힌트
- `PlayClient`가 로컬 상수 대신 공통 밸런싱 모듈을 참조하도록 변경

### UX/UI 개선
- 빌더 편집 로딩/오류 상태를 실제 배너 UI로 노출
- 탐험/내 던전 페이지에 난이도 필터 추가(검색과 조합)
- 공통 스타일 유틸 추가
  - `panel-surface`, `panel-surface-hover`, `input-surface`

## 4) 밸런스 조정 포인트
- 난이도별 수치 곡선을 재정비해 극단값을 완화함.
- 고난도에서 보상은 증가시키되, 시작 자원 증가율을 과도하지 않게 제한함.
- 함정 발동률은 난이도 차이를 유지하면서도 체감 박탈감을 줄이도록 보정함.

## 5) 검증 결과
- `npm run lint`: 통과
- `npm run build`: 통과

## 6) 다음 기술 과제 (권장)
- `PlayClient`를 전투/이벤트/보상/상태이상/장비 모듈로 분리
- AI 판정(JSON)용 스키마 검증 레이어(Zod 등) 도입
- 밸런스 시뮬레이터(배치 전투/경제 수렴 테스트) 추가
- 핵심 로직 단위 테스트(특히 보상 정산, 상태이상 tick, 장비 교체) 구축
