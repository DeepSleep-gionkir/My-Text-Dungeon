# ⛺ 06. Rest & Campfire System (Ultimate Guide)

## 1. 개요 (Overview)

**휴식처(Rest Site)**는 지친 모험가에게 주어진 유일한 안식처입니다.
하지만 로그라이트에서 100% 안전한 곳은 없습니다. 이곳에서의 **시간(Turn)**은 금이며, 무엇을 할지 신중하게 선택해야 합니다.
**"One Action Rule"**에 따라, 플레이어는 한정된 체류 시간 동안 가장 효율적인 정비를 마쳐야 합니다.

---

## 2. 하위 분류 (Sub-Categories)

### 2.1 Campfire (모닥불)

- **Code**: `CARD_REST_CAMPFIRE`
- **기능**: 가장 기본적인 휴식 공간. `HP/MP` 회복에 특화되어 있습니다.
- **Visual**: 따뜻한 불꽃이 튀는 모닥불. 배경음으로 장작 타는 소리(`Crackling Fire`).

### 2.2 Blacksmith (임시 대장간)

- **Code**: `CARD_REST_SMITHY`
- **기능**: 장비 **[수리]** 또는 **[강화]** 가능.
- **Visual**: 모루와 망치 소리가 들리는 낡은 천막.

### 2.3 Statue of Goddess (여신상)

- **Code**: `CARD_REST_STATUE`
- **기능**: 저주 해제(`Curse Cure`) 또는 축복(`Blessing`). 회복량은 적음.
- **Visual**: 이끼 낀 낡은 여신상. 신비로운 빛 번짐 효과.

---

## 3. 플레이어 관점 (Play Experience)

### 3.1 One Action Rule (일회성 행동)

일반적으로 휴식처에서는 **단 하나의 행동**만 수행할 수 있습니다. 행동을 마치면 휴식처 카드는 [비활성화] 되거나 [사라집니다].

1.  **💤 휴식 (Rest)**:
    - 가장 기본적인 선택. `HP 30%` + `MP 30%` 회복.
    - 상태이상(독, 화상 등)은 제거되지 않음. (제거하려면 `Cure` 행동 필요)
2.  **🔨 정비 (Smithing)**:
    - **Repair**: 내구도가 떨어진 장비를 수리.
    - **Sharpen**: `Weapon`의 공격력을 다음 3회 전투 동안 +10% 강화. (숫돌 사용)
3.  **🍳 요리 (Cooking)**:
    - 인벤토리의 식재료(`Raw Meat`, `Herb`)를 사용하여 버프 음식을 만듭니다.
    - _Recipe Examples_:
      - `Meat` + `Fire` = **Steak** (HP 50% Recov + ATK Up).
      - `Herb` + `Water` = **Tea** (MP 50% Recov + Clear Mind).
      - `Slime Gel` + `Fire` = **Dubious Food** (HP 10% Recov + Poison danger).
4.  **🧘 명상/기도 (Meditate)**:
    - `Random Event`. 신에게 기도를 올려 축복을 빕니다.
    - 운이 좋다면 `Full Heal`이나 `Resurrect Token`을 얻지만, 신이 외면하면 아무 일도 일어나지 않습니다.

### 3.2 기습 (Ambush Event)

"휴식을 취하려는데, 등 뒤에서 인기척이 느껴집니다."

- 일정 확률(난이도 비례 5~10%)로 휴식 도중 몬스터가 난입합니다.
- **Penalty**:
  - 선택한 회복/강화 행동 취소.
  - 즉시 전투 돌입.
  - 플레이어는 `Surprised`(기습) 상태로 시작하여 **첫 턴 행동 불가** (매우 위험).
- **Detection**: `Rogue`나 `Ranger`는 기습을 미리 감지하여 **[도주]** 하거나 **[역공]**할 수 있습니다.

---

## 4. 빌더 관점 (Builder's Strategy)

휴식처는 던전의 **[페이스 조절(Pacing)]** 장치입니다.

### 4.1 배치 간격 (Spacing)

- **Pacing**: `전투 - 전투 - 전투 - [휴식] - 보스` 흐름이 가장 이상적입니다.
- **Starvation**: 휴식처를 너무 안 주면 플레이어는 말라 죽고, 너무 많이 주면 긴장감이 사라집니다.

### 4.2 유형 선택 (Variant Selection)

- **Basic Campfire**: 가장 무난함.
- **Altar of Life**: 회복량은 적지만(`10%`), 죽은 동료를 살리거나 저주를 해제해 줍니다.
- **Cursed Campsite**: 회복량이 `100%`로 엄청나지만, 휴식 후 `Nightmare`급 몬스터가 확정적으로 등장합니다. (High Risk High Return)

---

## 5. 데이터 예시 (JSON)

```json
{
  "category": "CARD_REST_CAMPFIRE",
  "name": "버려진 야영지",
  "tags": ["SAFE_ZONE", "OUTDOOR"],
  "description": "누군가 쓰다 버린 장작이 남아있습니다. 아직 온기가 느껴집니다.",
  "actions": [
    {
      "type": "REST_HEAL",
      "value": 30, // 30%
      "text": "[쪽잠을 잔다] (HP/MP 30% 회복)"
    },
    {
      "type": "REST_COOK",
      "require": "ITEM_RAW_MEAT",
      "text": "[고기를 굽는다] (식재료 소모 -> 스테이크)"
    },
    {
      "type": "REST_SCOUT",
      "text": "[주변을 경계한다] (기습 확률 0%로 만듦)"
    }
  ],
  "ambush_rate": 0.05, // 5% 확률로 늑대 습격
  "ambush_monster": "CARD_ENEMY_WOLF_PACK"
}
```
