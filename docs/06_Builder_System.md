# 🏗️ 06. Dungeon Builder System

## 1. 개요 (Overview)

**Dungeon Builder**는 플레이어(Creator)가 AI와 협력하여 던전을 설계하는 핵심 공간입니다.
직관적인 드래그 앤 드롭(Drag & Drop) 인터페이스와 체계적인 카테고리 선택 시스템을 통해, 복잡한 프롬프팅 없이도 정교한 던전을 만들 수 있습니다.
모바일 비율에도 맞게 하기 위해 모바일에서는 어떤 구조로 표시할지 고민 필요.

## 2. UI 레이아웃 (Layout Design)

### 2.1 상단: 던전 그리드 (Dungeon Grid)

- **표시 방식**: 설정된 방 개수(Rooms)만큼의 빈 슬롯(`Slot`)이 나열됩니다.
- **Grid System**:
  - **PC**: 1줄에 10개 슬롯 (10열)
  - **Mobile**: 1줄에 4~5개 슬롯 (반응형)
- **Interaction**:
  - **Drop Zone**: 하단 덱(Deck)에서 카드를 드래그하여 배치.
  - **Click**: 배치된 카드를 클릭하면 좌측 패널에 상세 정보 표시.
  - **Validation**: 모든 슬롯이 채워져야 `[던전 게시]` 버튼 활성화.

### 2.2 하단: 카드 덱 (Card Deck)

- **Concept**: "나만의 카드 보관함" (Inventory Table)
- **기능**:
  - 생성된 카드가 최신순으로 적재.
  - **Infinite Cloning**: 이곳의 카드는 드래그 시 '이동'하는 것이 아니라 **'복사(Copy)'**되어 슬롯에 배치됨. (즉, 하나의 카드를 여러 방에 배치 가능)
  - Scrollable Container.
- **Visual**:
  - 카테고리별 고유 색상 테두리 및 아이콘 표시.

## 카드를 만들 때마다 firestore에 저장됨.

### 2.3 우측: 생성 스테이션 (Creation Station)

- **Step 1: 카테고리 선택 (Primary Category)**
  - `MONSTER` (몬스터)
  - `BOSS` (보스)
  - `TRAP` (함정)
  - `SHRINE` (제단/버프)
  - `TREASURE` (보물)
  - `NPC` (상호작용)
  - `REST` (휴식처)
- **Step 2: 세부 유형 선택 (Sub-Category)** (일부 카테고리만 해당)
  - `MONSTER` -> `Single`(단일) / `Squad`(군단)
  - `TRAP` -> `Instant`(즉발) / `Room`(지속/환경)
  - `NPC` -> `Trader`(상인) / `Quest`(의뢰) / `Talk`(대화)
- **Step 3: AI 프롬프팅 (Chat)**
  - 세부 유형까지 선택해야 채팅창 활성화.
  - 유저 입력: "불을 뿜는 빨간 용"
  - AI 처리: `난이도 계수` + `카테고리 템플릿` + `유저 입력`을 결합하여 카드 생성.

### 2.4 좌측: 상세 정보 (Detail Panel)

- 선택한 카드(Deck 또는 Grid)의 상세 스탯, 스킬, 플레이버 텍스트 표시.
  덱에서 카드를 보면 상세 정보라는 버튼이 존재, 또한 슬롯에 장착된 카드를 클릭하면 상세 정보를 볼 수 있음.

---

## 3. 생성 알고리즘 (Generation Logic)

### 3.1 난이도별 보정 (Difficulty Scaling)

던전의 난이도 설정(`EASY` ~ `NIGHTMARE`)은 AI가 카드를 생성할 때 즉시 반영됩니다.

| 난이도        | 몬스터 스탯 계수 | 함정 감지 난이도 | 보상(Gold) 배율 |
| :------------ | :--------------- | :--------------- | :-------------- |
| **EASY**      | 0.8x (약함)      | DC 10 (쉬움)     | 0.8x            |
| **NORMAL**    | 1.0x (표준)      | DC 15 (보통)     | 1.0x            |
| **HARD**      | 1.3x (강함)      | DC 18 (어려움)   | 1.5x            |
| **NIGHTMARE** | 1.8x (치명적)    | DC 22 (극악)     | 2.5x            |

### 3.2 필수 데이터 검증

AI가 생성한 JSON은 다음 항목을 반드시 포함해야 합니다. (Schema Validation)

1.  **Tag**: 최소 2개 이상의 시스템 태그 (예: `TAG_BEAST`, `ATTR_FIRE`).
2.  **Stats**: 카테고리에 맞는 스탯 필드 (비전투 카드는 null).
3.  **Actions**: 전투/함정 카드는 최소 1개 이상의 행동 패턴.

---

## 4. 모바일 최적화 (Mobile Experience)

- **Touch Action**: 드래그 앤 드롭이 터치 환경에서도 부드럽게 작동해야 함 (`dnd-kit` 등 활용).
- **Layout Shift**: 키보드가 올라올 때 UI가 깨지지 않도록 채팅창(우측 패널)을 모달이나 별도 레이어로 처리 고려.
