# ⛩️ 03. Shrine & Object System (Ultimate Guide)

## 1. 개요 (Overview)

**제단(Shrine)**은 신성하거나 저주받은 장소로, 플레이어에게 **[선택]**을 강요합니다.
단순히 "버프를 받았다"가 아니라, **"무엇을 바치고, 무엇을 얻을 것인가?"**라는 등가교환(Trade-off)이 핵심입니다.

---

## 2. 구조 및 분류 (Structure)

하나의 Shrine 카드는 내부적으로 **5개의 선택지(Options)**를 가집니다.
플레이어는 이 중 **하나를 선택**하거나, 위험하다고 판단되면 **무시하고 지나갈(Skip)** 수 있습니다.

### 2.1 구성 요소 (Components)

- **Offer (대가/비용)**: `HP 소모`, `골드 지불`, `저주 받기`, `아이템 바치기`.
- **Boone (축복/보상)**: `스탯 영구 상승`, `풀회복`, `유물 획득`, `희귀 아이템`.

---

## 3. 생성 모드 (Builder Modes)

빌더는 두 가지 방식으로 제단을 만들 수 있습니다.

### 3.1 AI Generation (자동 생성)

- **Process**: 빌더가 컨셉만 입력합니다. (예: "악마와의 거래", "치유의 샘")
- **Result**: AI가 컨셉에 어울리는 **5개의 버프/대가 쌍**을 자동으로 생성합니다.
  - _예시 (악마의 제단)_:
    1.  [HP -30] -> [공격력 +5]
    2.  [최대 체력 -10%] -> [모든 스킬 쿨타임 감소]

### 3.2 Manual Assembly (직접 조립)

- **Concept**: **"Mix & Match"** (10-Slot System)
- **Pool**: 시스템이 제공하는 **총 12종의 버프 프리셋**과 **12종의 대가 프리셋**이 주어집니다.
- **Process**:
  1.  **Select Rewards (5/12)**: 플레이어에게 주고 싶은 보상 5개를 선택합니다.
  2.  **Select Costs (5/12)**: 그에 상응하는 대가 5개를 선택합니다.
  3.  **Pairing**: 선택된 5개의 보상과 5개의 대가를 **1:1로 매칭**하여 최종 선택지(Option)를 완성합니다.

---

## 4. 상세 프리셋 데이터 (Preset Data - Detailed)

빌더가 조립 시 선택할 수 있는 12가지 옵션을 상세히 정의합니다.

### 4.1 Reward Pool (축복)

| ID        | 명칭                | 효과                 | 설명                                     |
| :-------- | :------------------ | :------------------- | :--------------------------------------- |
| **RW_01** | **Mighty Strength** | `ATK +3` (Permanent) | 가장 인기 있는 공격형 보상.              |
| **RW_02** | **Iron Skin**       | `DEF +3` (Permanent) | 생존력을 높여주는 방어형 보상.           |
| **RW_03** | **Wind Walker**     | `SPD +5` (Permanent) | 선공권을 가져가기 위한 필수 스탯.        |
| **RW_04** | **Vitality**        | `MaxHP +10%`         | 장기적으로 가장 효율 좋은 체력 뻥튀기.   |
| **RW_05** | **Divine Heal**     | `HP 100% Recover`    | 죽어가는 플레이어를 살리는 구원.         |
| **RW_06** | **Clarify**         | `Remove All Debuffs` | 영구 저주나 독을 해제.                   |
| **RW_07** | **Wealth**          | `Gain 500 Gold`      | 상점에서 아이템 2~3개를 살 수 있는 거금. |
| **RW_08** | **Mystery Box**     | `Random Rare Item`   | 무엇이 나올지 모르는 랜덤박스.           |
| **RW_09** | **Relic Shard**     | `Gain Relic Piece`   | 3개를 모으면 전설 유물 완성.             |
| **RW_10** | **Skill Surge**     | `Cooldown Reset`     | 모든 스킬 쿨타임 초기화.                 |
| **RW_11** | **Second Life**     | `Resurrect Token`    | 사망 시 1회 부활 (가장 귀함).            |
| **RW_12** | **Overload**        | `All Stats +1`       | 전 스탯 소폭 상승.                       |

### 4.2 Cost Pool (대가)

| ID        | 명칭             | 효과                   | 설명                          |
| :-------- | :--------------- | :--------------------- | :---------------------------- |
| **CS_01** | **Bloodletting** | `Loose 30 HP`          | 현재 체력 즉시 감소.          |
| **CS_02** | **Sacrifice**    | `MaxHP -10%`           | 최대 체력 영구 감소 (뼈아픔). |
| **CS_03** | **Frailty**      | `DEF -2` (Permanent)   | 몸이 약해짐.                  |
| **CS_04** | **Drain Mana**   | `Loose 50 MP`          | 마법사에게 치명적.            |
| **CS_05** | **Poverty**      | `Loose 200 Gold`       | 가진 돈을 바침.               |
| **CS_06** | **Curse: Pain**  | `Status: Bleed` (Perm) | 해제하기 전까지 매 턴 데미지. |
| **CS_07** | **Curse: Blind** | `Accuracy -20%`        | 공격 빗나감 확률 증가.        |
| **CS_08** | **Curse: Weak**  | `ATK -20%`             | 공격력 감소.                  |
| **CS_09** | **Summon Elite** | `Spawn Elite Mob`      | 즉시 전투 발생 (강제).        |
| **CS_10** | **Destruction**  | `Destroy 1 Item`       | 인벤토리 아이템 하나 소멸.    |
| **CS_11** | **Time Warp**    | `Dungeon Time -10m`    | 타임어택 제한시간 감소.       |
| **CS_12** | **Nothing**      | `No Cost`              | 대가 없음 (혜자).             |

---

## 5. 플레이어 관점 (Play Experience)

### 5.1 5개의 운명 (The 5 Choices)

제단 위에는 5개의 촛불(혹은 두루마리)이 놓여 있습니다. 각 선택지는 대가와 보상이 명시되어 있습니다.

- _Option 1_: `[HP -10]` 바치고 -> `[50 Gold]` 획득. (소소한 거래)
- _Option 2_: `[MaxHP -20%]` 바치고 -> `[ATK +5]` 획득. (뼈를 깎는 강화)
- _Option 3_: `[저주: 받는 피해 20% 증가]` 받고 -> `[전설의 검]` 획득. (위험한 도박)
- _Option 4_: 무료. (함정일 수도 있음)
- _Option 5_: `[100 Gold]` 내고 -> `[HP 풀회복]`. (서비스)

플레이어는 이 중 **하나를 선택**하거나, **아무것도 하지 않고 떠날(Skip)** 수 있습니다.
"과연 이 페널티를 감수할 가치가 있을까?"를 끊임없이 고민하게 됩니다.

---

## 6. 빌더 관점 (Builder's Strategy)

### 6.1 설계 전략 (Design Patterns)

1.  **The Trap Shrine**: 보상은 짜고 대가는 가혹하게. 실수 유발.
    - _조합_: `CS_02 (MaxHP -10%)` + `RW_07 (500 Gold)` -> 체력 깎아서 돈 벌기.
2.  **The Devil's Deal**: 거부할 수 없는 보상(`Legendary`)과 치명적 대가(`Perm Curso`).
    - _조합_: `CS_06 (Perm Bleed)` + `RW_11 (Resurrect)` -> 피를 흘리며 불멸을 얻음.
3.  **The Safe Haven**: 돈을 내고 회복하는 유료 쉼터.
    - _조합_: `CS_05 (Pay Gold)` + `RW_05 (Full Heal)` -> 전형적인 성직자 스타일.

---

## 7. 데이터 예시 (JSON)

```json
{
  "category": "CARD_SHRINE",
  "name": "피의 맹약 제단",
  "tags": ["THEME_DARK", "TRADE_OFF"],
  "description": "검붉은 액체가 흐르는 제단입니다. 누군가의 목소리가 들립니다. '원하는 것을 얻으려면 고통을 감내하라.'",
  "options": [
    {
      "id": "OPT_01",
      "cost_type": "HP_FLAT_HIGH",
      "cost_value": 30,
      "reward_type": "STAT_ATK_UP",
      "reward_value": 3,
      "text": "[피의 의식] 생명력을 바쳐 힘을 얻습니다. (HP -30, ATK +3)"
    },
    {
      "id": "OPT_02",
      "cost_type": "ADD_DEBUFF",
      "cost_value": "STATUS_BLEED_PERM", // 영구 출혈
      "reward_type": "ADD_BUFF",
      "reward_value": "BUFF_VAMPIRISM", // 흡혈 능력
      "text": "[고통의 순환] 출혈을 얻는 대신, 적의 피를 흡수합니다."
    },
    {
      "id": "OPT_03",
      "cost_type": "SUMMON_ENEMY",
      "cost_value": "ELITE_DEMON",
      "reward_type": "GAIN_ITEM_LEGENDARY",
      "reward_value": "ITEM_DEMON_SWORD",
      "text": "[힘의 증명] 제단을 지키는 악마를 처치하면 검을 줍니다."
    }
  ]
}
```
