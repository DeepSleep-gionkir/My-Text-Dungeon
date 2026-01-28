# 🛤️ 04. Development Roadmap

## Phase 1: UI/UX Foundation (완료) ✅

- [x] **Project Setup**: Vite + React + Firebase 연동.
- [x] **Design System**: Global CSS, Fonts(Cinzel), Animations.
- [x] **Auth UI**: 몰입감 있는 로그인 화면(Great Gate).
- [x] **Builder UI**:
  - Chat Interface 구현.
  - Gemini API Key 관리(BYOK) 및 검증 로직 구현.
  - 사용자 정의 난이도/방 갯수 설정 구현.

## Phase 2: Core Logic & AI Tuning (현재 진행 중) 🚧

- [ ] **Gemini Prompt Engineering**
  - JSON Output Consistency 확보.
  - 난이도별(Easy~Nightmare) 스탯 밸런싱 프롬프트 적용.
  - 다양한 몬스터/함정 아키타입(Archetype) 학습.
- [ ] **Battle System Implementation**
  - `DungeonPlayPage` 개발.
  - 턴제 전투 로직 (속도 기반 턴 계산).
  - 데미지/효과 연산 엔진 구현.
- [ ] **Navigation & Exploration**
  - 방 이동 로직, 미니맵(선택적).
  - 이벤트(Rest, Shop) 처리.

## Phase 3: Metagame & Polish 🔮

- [ ] **User Progression**
  - 골드 획득 및 저장.
  - 로비(Hub)에서의 영구적 스탯 강화.
- [ ] **Sound & Audio**
  - BGM 및 상황별 SFX 적용 (타격음, UI 클릭음).
- [ ] **Mobile Optimization**
  - 터치 인터페이스 최적화.
  - PWA(Progressive Web App) 고려.
- [ ] **Community Features**
  - 던전 좋아요/랭킹 시스템.
