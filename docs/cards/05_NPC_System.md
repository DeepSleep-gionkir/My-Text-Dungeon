# 🗣️ 05. NPC & Quest System

## 1. 개요 (Overview)

**NPC(Non-Player Character)**는 삭막한 던전에서 만나는 제3의 존재들입니다.
그들은 플레이어에게 물건을 팔거나(`Trader`), 도움을 요청(`Quest`)하거나, 때로는 배신(`Betrayal`)할 수도 있습니다.

---

## 2. 하위 분류 (Sub-Categories)

### 2.1 Trader (상인)

- **Code**: `CARD_NPC_TRADER`
- **기능**:
  - **Buy**: 던전 내에서 획득한 골드로 소모품/장비 구매.
  - **Sell**: 필요 없는 장비 판매 (인벤토리 확보).
- **특징**: 상인마다 취급 품목이 다름 (`Blacksmith`=무기, `Alchemist`=포션).

### 2.2 Quest Giver (의뢰인)

- **Code**: `CARD_NPC_QUEST`
- **기능**: 던전 내에서 완수할 수 있는 **[Sub-Quest]**를 부여.
- **예시**:
  - "내 잃어버린 펜던트를 찾아주게." -> 특정 방의 상자 열기.
  - "저 앞의 거미들을 처리해줘." -> `TAG_SPIDER` 몬스터 3마리 처치.
- **보상**: 즉시 `Key Item` 지급 또는 유니크 버프.

### 2.3 Talker (대화/정보)

- **Code**: `CARD_NPC_TALK`
- **기능**: 스토리 텔링 및 힌트 제공.
- **예시**: "이 층의 보스는 불을 싫어해." (보스 약점 정보 제공).

---

## 3. 작동 로직 (Mechanics)

### 3.1 상호작용 (Interaction)

NPC 카드를 클릭하면 **대화 창(Dialogue UI)**이 열립니다.

1.  **Greeting**: NPC의 첫 마디. (성격에 따라 다름)
2.  **Options**:
    - `[Trade]`: 상점 UI 열기.
    - `[Talk]`: 대화 진행.
    - `[Attack]`: **NPC 공격 가능.** (죽이면 소지품 드랍 + 현상수배 디버프)

### 3.2 평판 (Reputation / Friendly Fire)

- NPC를 공격하거나 훔치기를 시도하면, 해당 던전 내의 **모든 NPC가 적대적(`HOSTILE`)**으로 변할 수 있습니다.
- 적대적 NPC는 `CARD_ENEMY_SINGLE` 취급을 받아 전투가 발생합니다.
- 상인을 죽이면 상점 이용 불가 + 강력한 경비병 등장 리스크.

### 3.3 퀘스트 추적 (Quest Tracking)

- 퀘스트를 수락하면 화면 우측 상단에 **[Quest Log]**가 표시됩니다.
- 조건 달성 시(예: 거미 3/3 처치), NPC에게 돌아갈 필요 없이 **즉시 보상**을 받거나, 다시 돌아와야 보상을 받는 식 (`Return Required: true/false`)으로 나뉩니다.

---

## 4. 데이터 예시 (JSON)

### 4.1 떠돌이 상인 (Trader)

```json
{
  "category": "CARD_NPC_TRADER",
  "name": "겁쟁이 고블린 상인",
  "description": "큰 배낭을 멘 고블린이 당신을 보고 깜짝 놀랍니다. '저, 저리가! ...아니면 물건을 살 텐가?'",
  "trade_list": [
    { "id": "ITEM_POTION_HP_S", "price": 50 },
    { "id": "ITEM_SCROLL_FIREBALL", "price": 120 }
  ],
  "hp": 30, // 공격 가능 (약함)
  "loot_on_death": ["ITEM_BAG_OF_GOLD"] // 죽이면 돈가방 드랍
}
```

### 4.2 현상금 사냥꾼 (Quest)

```json
{
  "category": "CARD_NPC_QUEST",
  "name": "부상당한 기사",
  "description": "피를 흘리며 주저앉은 기사입니다.",
  "dialogue": {
    "start": "저 앞방에... 내 동료를 죽인 오우거가 있다... 복수해다오...",
    "accept": "고맙다. 이 검을 가져가라.",
    "reject": "겁쟁이 녀석..."
  },
  "quest": {
    "target": "KILL_MONSTER",
    "target_tag": "TAG_OGRE",
    "count": 1,
    "reward": "ITEM_KNIGHT_SWORD"
  }
}
```
