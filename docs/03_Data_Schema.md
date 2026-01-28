# 💾 03. Data Schema & Architecture

## 1. Card JSON Schema (Gemini Output)

AI(Gemini)가 생성해야 하는 카드의 엄격한 JSON 구조입니다. 프론트엔드는 이 구조를 파싱하여 UI를 렌더링합니다.

```typescript
interface CardData {
  // 카드의 종류
  category:
    | "CARD_ENEMY_SINGLE" // 일반 몬스터 (1마리)
    | "CARD_ENEMY_SQUAD" // 몬스터 무리 (다수)
    | "CARD_BOSS" // 보스
    | "CARD_TRAP_INSTANT" // 즉발 함정
    | "CARD_TRAP_ROOM" // 지속 함정/환경
    | "CARD_LOOT_CHEST" // 보물 상자
    | "CARD_SHRINE" // 버프/회복 제단
    | "CARD_EVENT_CHOICE" // 선택지 이벤트
    | "CARD_NPC_TRADER"; // 상인

  // 기본 정보
  name: string; // 카드 이름 (예: "얼음 송곳니 늑대")
  description: string; // 플레이버 텍스트 (등장 묘사)
  grade: "NORMAL" | "ELITE" | "BOSS"; // 등급 (테두리 색상 결정)

  // 상세 스탯 (몬스터/보스용) - 비전투 카드는 null
  stats?: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
  };

  // 태그 시스템 (상성 및 로직 처리에 사용)
  tags: string[];
  // 예: ["TAG_BEAST", "ATTR_ICE", "ENV_COLD", "WEAK_FIRE"]

  // 행동 패턴 (전투/함정 로직)
  actions: {
    trigger: "ON_TURN" | "ON_HIT" | "HP_BELOW_50" | "PASSIVE";
    type: "LOGIC_ATTACK" | "LOGIC_AOE" | "LOGIC_HEAL" | "LOGIC_BUFF";
    value: number; // 계수 (1.0 = 공격력의 100%)
    msg: string; // 행동 시 출력될 텍스트 (예: "늑대가 목덜미를 물어뜯습니다!")
  }[];

  // 보상 (처치/해제 시)
  rewards?: {
    gold: number;
    items: string[]; // 아이템 ID 목록 (예: ["ITEM_POTION_S", "ITEM_WOLF_PELT"])
  };
}
```

## 2. Firestore Database Model

Google Cloud Firestore(NoSQL) 데이터 구조입니다.

### `users` Collection

유저의 메타 진행 정보 저장.

- `uid` (Document ID)
- `nickname`: string
- `stats`: { str: number, dex: number, int: number, ... } // 영구 스탯
- `unlocks`: string[] // 해금된 직업/스킨 ID 목록
- `resources`: { gold: number, essence: number }

### `dungeons` Collection

유저가 생성하고 게시한 던전 정보.

- `id` (Document ID)
- `creator_uid`: string
- `name`: string
- `description`: string
- `difficulty`: "EASY" | "NORMAL" | "HARD" | "NIGHTMARE"
- `room_count`: number (15~50)
- `card_list`: CardData[] // 생성된 카드들의 JSON 배열 (압축/직렬화 고려)
- `likes`: number
- `play_count`: number
- `created_at`: fieldvalue.serverTimestamp()

## 3. Tech Stack

- **Web Framework**: React (Vite)
- **Language**: JavaScript (ES6+) / JSDoc Type Checking
- **State Management**: Zustand
- **Styling**: Vanilla CSS (CSS Modules approach) + Framer Motion
- **Backend**: Firebase (Auth, Firestore)
- **AI Engine**: Google Gemini 2.5 Flash API
