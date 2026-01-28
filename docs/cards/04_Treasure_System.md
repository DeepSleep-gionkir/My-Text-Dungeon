# 💰 04. Treasure & Loot System (Ultimate Guide)

## 1. 개요 (Overview)

**보물(Treasure)**은 모험의 가장 큰 동기이자 보상입니다.
하지만 모든 상자가 안전한 것은 아닙니다. 어떤 상자는 잠겨있고(`LOCKED`), 어떤 상자는 이빨을 드러냅니다(`MIMIC`).

---

## 2. 하위 분류 (Sub-Categories)

### 2.1 Standard Chest (일반/잠긴 상자)

- **Code**: `CARD_LOOT_CHEST`
- **특징**:
  - **Open**: 그냥 열기 (기본).
  - **Locked**: `ITEM_KEY`가 필요하거나, `LUK/STR` 스탯으로 강제 개방 시도.
  - **Mimicry**: 일정 확률로 몬스터(`MIMIC`)로 돌변.

### 2.2 Material Pile (재료/채집물)

- **Code**: `CARD_LOOT_MATERIAL`
- **특징**: 광맥, 약초 더미, 몬스터 시체 등.
- **Interaction**: `Mining`(채광), `Gathering`(채집) 도구나 스킬 필요.

---

## 3. 작동 로직 (Mechanics)

### 3.1 미믹 판별 (Mimic Check)

모든 보물 상자는 생성 시 **[Real]** 또는 **[Fake]** 속성을 가집니다.

- **육안 식별**: 겉모습은 100% 동일합니다.
- **행동 식별**: '살짝 건드리기(Poke)'나 '관찰(Observe)' 행동을 통해 미믹 여부를 힌트로 얻을 수 있습니다.
  - _Real_: "묵직한 금속음이 들립니다."
  - _Fake_: "상자가 미세하게 숨을 쉬는 것 같습니다.", "침이 흘러나옵니다."
- **리스크**: 미믹을 그냥 열려고 하면 **기습(Ambush)** 당해 큰 피해를 입고 전투가 시작됩니다.

### 3.2 잠금 해제 (Unlock)

잠긴 상자(`LOCKED`)를 여는 방법은 세 가지입니다.

1.  **열쇠 사용 (`ITEM_MASTER_KEY`)**: 100% 성공. 아이템 소모.
2.  **물리적 파괴 (`STR` Check)**:
    - 성공 시: 상자가 열리지만 내용물 중 일부가 **파손(Broken)**될 확률 있음.
    - 실패 시: `Time Penalty` 또는 `Noise`(몬스터 유인).
3.  **자물쇠 따기 (`DEX/LUK` Check)**:
    - 성공 시: 패널티 없이 획득. `Rogue` 직업 보정.
    - 실패 시: 함정 발동(독침 등).

---

## 4. 플레이어 관점 (Play Experience)

### 4.1 상자 여는 과정 (The Opening Process)

단순히 클릭 -> 획득이 아닙니다. 상자도 하나의 **이벤트(Encounter)**입니다.

1.  **탐색 (Inspect)**: `[살펴보기]` 버튼.
2.  **결정 (Decide)**:
    - **[열기 (Open)]**: 가장 빠름. 하지만 미믹이면 팔이 잘릴 수 있음.
    - **[부수기 (Smash)]**: 안전하지만 보상이 줄어들 수 있음.
    - **[지나치기 (Ignore)]**: 아무것도 얻지 못하지만 가장 안전함.

### 4.2 보상 유형 (Reward Types)

로그라이트의 밸런스를 위해 보상을 구분합니다.

- **Volatile (휘발성/인게임)**: 던전 내 생존을 위한 아이템 (포션, 스크롤, 임시 버프).
- **Permanent (소유형/메타)**: 로비로 가져가는 재화 (Gold, Essence, Blueprint).

---

## 5. 빌더 관점 (Builder's Strategy)

### 5.1 미믹 배치 (The Mimicry)

- **배치 전략**: 가장 힘든 전투 직후나, 열쇠가 필요한 잠긴 상자로 위장하여 배치하세요.
- **Types**:
  - `Wood Mimic`: 약함. 깜짝 놀래키기용.
  - `Iron Mimic`: 방어력 높음. 물리 공격 반사.
  - `Jewel Mimic`: 처치 시 엄청난 보상을 주지만 공격력이 매우 높음 (High Risk).

### 5.2 등급별 상세 보상 테이블 (Loot Table Detail)

빌더는 상자의 `Grade`를 설정하여 드랍률을 조정할 수 있습니다.

| 등급              | Gold (Meta) | Item (In-Game)               | Description                       |
| :---------------- | :---------- | :--------------------------- | :-------------------------------- |
| **Old Box**       | 10~50G      | `Old Dagger`, `Minor Potion` | 길가에 널려있는 잡동사니.         |
| **Iron Chest**    | 100~200G    | `Steel Sword`, `Chainmail`   | 중간 보스 처치 보상으로 적합.     |
| **Golden Chest**  | 500G+       | `Magic Wand`, `Plate Armor`  | 히든 룸이나 퍼즐 해결 보상.       |
| **Legendary Box** | 2000G       | `Excalibur`, `Ring of Power` | 전설급 아이템. 나오면 무조건 깸.  |
| **Cursed Chest**  | 1000G+      | `Demon Leaf` + `Curse`       | 강력한 힘을 주지만 리스크를 동반. |

---

## 6. 데이터 예시 (JSON)

```json
{
  "category": "CARD_LOOT_CHEST",
  "name": "고대 룬어 상자",
  "grade": "EPIC",
  "tags": ["LOCKED_MAGIC", "TRAP_CURSE"],
  "description": "상자 표면에 푸른색 룬 문자가 빛나고 있습니다.",
  "check_info": {
    "stat": "INT",
    "difficulty": 15
  },
  "rewards": {
    "gold": { "min": 300, "max": 600 },
    "items": [
      { "id": "ITEM_MEMOIR_PAGE", "rate": 1.0, "name": "기억의 조각" },
      { "id": "ITEM_STAFF_EPIC", "rate": 0.5, "name": "대현자의 지팡이" }
    ]
  },
  "mimic_data": null
}
```
