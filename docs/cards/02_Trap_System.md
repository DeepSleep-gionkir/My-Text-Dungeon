# ☠️ 02. Trap & Obstacle System (Expanded)

## 1. 개요 (Overview)

**함정(Trap)**은 몬스터 못지않은 치명적인 위협입니다. 플레이어의 자원(HP/MP)을 소모시키거나 상태이상을 유발하여 이후 전투를 불리하게 만듭니다.
단순히 "밟았다!"로 끝나는 것이 아니라, **[감지] -> [판단] -> [해제/회피]**의 인터랙티브한 과정을 제공합니다.

---

## 2. 하위 분류 및 메커니즘 (Classification)

### 2.1 Instant Trap (즉발형)

- **Code**: `CARD_TRAP_INSTANT`
- **특징**: 방에 진입하는 순간 **[확률적]**으로 발동하는 1회성 위협.
- **예시**:
  - **Scythe trap**: 횡으로 베고 지나가는 거대 낫. `Jump`(회피) 필요.
  - **Dart trap**: 독침 발사. `Shield`(방어) 필요.
- **발동 확률 (Trigger Chance)**: 난이도에 비례 (Easy 30% ~ Nightmare 90%).

### 2.2 Environmental Trap (지속형/환경)

- **Code**: `CARD_TRAP_ROOM`
- **특징**: 방 전체에 영향을 미침. 해제(Disarm)하기 전까지 **매 턴** 효과를 발휘함.
- **예시**:
  - **Filling Water**: 물이 차오름. 5턴 후 `Drown`(익사/사망).
  - **Poison Gas**: 매 턴 중독 스택 +1.
  - **Heat Wave**: 금속 갑옷 착용자에게 매 턴 화상 데미지.

### 2.3 Magical Trap (마법/저주)

- **Code**: `CARD_TRAP_MAGIC`
- **특징**: 물리 해제 불가. `Mana`를 역류시키거나 `Confuse`(혼란)를 검.
- **해제법**: `INT` 스탯 체크 또는 `Dispel` 마법 사용.

---

## 3. 플레이어 관점 (Play Experience)

### 3.1 인터랙티브 대응 (Interactive Response)

함정을 발견했을 때, 플레이어는 상황에 맞는 행동을 선택해야 합니다.

| 행동                 | 필요 조건              | 성공 시                          | 실패 시                                 |
| :------------------- | :--------------------- | :------------------------------- | :-------------------------------------- |
| **🛠️ 해제 (Disarm)** | `DEX` / `Technique`    | 함정 제거 + **부품(Loot) 획득**. | **치명타 피해** (1.5x) + 상태이상 직격. |
| **🏃 회피 (Dodge)**  | `SPD` / `Agility`      | 피해 없이 통과. (함정은 남음)    | 일반 피해 (1.0x).                       |
| **🛡️ 방어 (Tank)**   | `DEF` / `Constitution` | 피해 감소 (0.5x).                | 피해 감소 실패 (0.8x).                  |
| **📜 마법 (Magic)**  | `INT` / `Spell`        | 원격 해제 or 무효화. (MP 소모)   | 마법 역류 (MP 데미지).                  |

### 3.2 직업별 보정

- **Rogue**: 모든 함정의 감지 및 해제 성공률 **+20%**.
- **Warrior**: 물리 함정(`Scythe`, `Rock`)에 대한 방어 효율 증가.
- **Mage**: 마법 함정 감지 가능.

---

## 4. 빌더 관점 (Builder's Strategy)

함정은 **심리전**이자 **콤보의 시작**입니다.

### 4.1 심리적 딜레마 (Dilemma Design)

- **갈림길 (Fork)**:
  - **Path A**: 몬스터(`Weak`)가 보이지만 보상은 없음.
  - **Path B**: 아무것도 안 보임(함정 가능성). 하지만 끝에 `Treasure`가 보임.
  - -> 플레이어의 탐욕을 시험하는 배치를 하십시오.

### 4.2 시너지 배치 (Combo Setup)

함정을 단독으로 쓰지 마십시오.

- **Oil & Fire**: `기름 함정`(미끄러짐/Oil Status) 방 바로 다음에 `Fire Elemental` 몬스터 방 배치. (불 붙으면 즉사급 피해)
- **Silence & Mage**: `침묵의 룬`(마법 사용 불가) 함정을 `Iron Golem`(물리 내성) 방에 배치. (마법사는 아무것도 못하고 도망쳐야 함)
- **Alarm Trap**: 데미지는 없지만, 작동 시 **인접한 방의 모든 몬스터를 깨워서 호출**하는 함정.

---

## 5. 데이터 구조 (Technical Specs)

### 5.1 JSON Structure

```json
{
  "category": "CARD_TRAP_ROOM",
  "name": "고대 독사 구덩이",
  "grade": "HARD",
  "tags": ["ENV_POISON", "TAG_BEAST", "CONTINUOUS"],
  "description": "발밑이 꺼지며 수천 마리의 독사가 우글거리는 구덩이에 빠집니다.",
  "check_info": {
    "stat": "LUK",
    "difficulty": 18 // DC 18 (어려움)
  },
  "actions": [
    {
      "trigger": "ON_TURN_START",
      "type": "LOGIC_DEBUFF_TARGET",
      "effect": "STATUS_POISON",
      "value": 2,
      "msg": "독사들이 발목을 물어뜯습니다! (독 스택 +2)"
    },
    {
      "trigger": "ON_DISARM_SUCCESS",
      "msg": "덩굴을 타고 기적적으로 기어올라옵니다.",
      "reward": "ITEM_SNAKE_VENOM" // 해제 보상
    }
  ]
}
```

### 5.2 난이도별 발동 확률 (Trigger Rates)

- **EASY**: 30%. (초보자가 함정에 의문사를 당하지 않도록)
- **NORMAL**: 50%. (동전 던지기)
- **HARD**: 70%. (항상 해제 준비를 해야 함)
- **NIGHTMARE**: 90%. (사실상 전투와 다름없는 자원 소모 강요)
