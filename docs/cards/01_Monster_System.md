# 👹 01. Monster System (Expanded)

## 1. 개요 (Overview)

`MONSTER` 카테고리는 던전의 가장 기본적이고 빈번한 위협입니다.
단순히 체력만 높은 샌드백이 아니라, **시스템 태그(Keyword)**에 기반한 지능적인 행동 패턴과 명확한 약점/강점을 가집니다.

---

## 2. 하위 분류 (Sub-Categories)

### 2.1 Single Entity (단일 개체)

- **Code**: `CARD_ENEMY_SINGLE`
- **특징**: 표준적인 스탯. 1:1 전투.
- **Builder Tip**: 좁은 길목이나 문을 지키는 문지기 역할로 배치하기 좋습니다.

### 2.2 Squad / Swarm (군단/무리)

- **Code**: `CARD_ENEMY_SQUAD`
- **특징**:
  - **Action Count**: 턴당 2~3회 행동 (개별 데미지는 낮음).
  - **Shared HP**: 하나의 긴 HP 바를 공유하거나, 스택(Stack)형 HP를 가짐.
  - **Weakness**: 광역 공격(AoE) 피격 시 **1.5배 ~ 2.0배** 피해.
- **Builder Tip**: 광역기 스킬을 가진 `Mage` 플레이어에게 카타르시스를 주기 위해 배치하세요.

### 2.3 Elite & Leader (지휘관)

- **Code**: `CARD_ENEMY_ELITE`
- **특징**: 일반 몬스터보다 스탯 1.5배 + 고유 패시브 보유.
- **Aura**: 주변(같은 방)의 다른 몬스터에게 버프를 제공함. (예: `Leadership` - 아군 명중률 상승)
- **Builder Tip**: 보스 방 직전이나 중간 보급소(Rest) 앞에 수문장으로 배치하세요.

---

## 3. 플레이어 관점 (Play Experience)

### 3.1 공략의 핵심: 태그(Tag) 역이용

몬스터를 잡는 방법은 단순히 '때리기'만 있는 것이 아닙니다.

- **속성 카운터**:
  - `TAG_PLANT`(식물) 적에게 `Fire` 공격 -> **2.0배 피해** + `Burn`(화상).
  - `TAG_CONSTRUCT`(기계) 적에게 `Water`를 뿌리고(`Wet`) `Lightning` 공격 -> **감전(Stun)** + **확정 치명타**.
- **상태이상 연계**:
  - `Sound`(소음) 공격으로 `TAG_BEAST`(야수)나 `TAG_BAT`(박쥐)를 기절(`Stun`)시킬 수 있습니다.
  - `Holy`(신성) 회복 마법을 `TAG_UNDEAD`에게 사용하면 강력한 **공격기**로 변합니다.

### 3.2 행동 패턴 예측 (Telegraphs)

강력한 공격은 전조 증상(Telegraph)이 있습니다.

- _"오우거가 거대한 몽둥이를 높이 쳐듭니다."_ (다음 턴 `Heavy Smash`)
  - -> **[방어]**하거나 **[회피]** 기술 사용 필수.
- _"고블린이 주머니에서 빨간 물약을 꺼냅니다."_ (다음 턴 `Enrage` or `Heal`)
  - -> **[방해(Interrupt)]** 스킬이나 **[스턴]**으로 행동 캔슬 필요.

---

## 4. 빌더 관점 (Builder's Strategy)

단순히 강한 몬스터를 깔아두는 것은 하수입니다. **시너지(Synergy)**와 **지형(Environment)**을 이용하세요.

### 4.1 지형 결합 (Environmental Combo)

- **수중전 (`ENV_UNDERWATER`)**:
  - `TAG_AQUATIC`(수생) 몬스터(멀록, 상어)를 배치하면 속도가 2배가 됩니다.
  - 플레이어는 전기 마법을 쓰기 꺼려집니다 (자신도 감전되니까요). 빌더는 이를 노려 **기계형 플레이어**를 카운터칠 수 있습니다.
- **용암 지대 (`ENV_MAGMA`)**:
  - `TAG_FIRE_ELEMENTAL`을 배치하면 매 턴 체력을 회복합니다.
  - 플레이어는 화상 데미지 + 회복하는 적이라는 이중고를 겪습니다.

### 4.2 연쇄 배치 (Chain Placement)

- **Room 1**: `TAG_INSECT`(벌레 떼) 배치. (플레이어의 광역기 소모 유도)
- **Room 2**: `TAG_GIANT` 배치. (단일 딜이 부족해진 플레이어를 압살)
- **Room 3**: `Rest Site` (겨우 살았다 싶을 때 안식처 제공 -> 긴장감 조절)

---

## 5. 데이터 구조 및 AI 로직 (Technical Specs)

### 5.1 JSON Structure

```json
{
  "category": "CARD_ENEMY_SQUAD",
  "name": "굶주린 늑대 무리 (5마리)",
  "grade": "NORMAL",
  "tags": ["TAG_BEAST", "TAG_PACK_TACTICS", "WEAK_FIRE", "LOW_MORALE"],
  "stats": {
    "hp": 200, // 5마리분 합산
    "atk": 8, // 개체당 공격력
    "def": 0,
    "spd": 15 // 매우 빠름
  },
  "actions": [
    {
      "trigger": "ON_TURN_START",
      "type": "LOGIC_MULTI_ATTACK",
      "count": 3,
      "value": 1.0,
      "msg": "늑대 세 마리가 동시에 달려듭니다!"
    },
    {
      "trigger": "ON_ALLY_DEATH", // 동료가 죽으면
      "type": "LOGIC_BUFF_SELF",
      "effect": "BUFF_ENRAGE",
      "msg": "동료의 죽음을 본 늑대들이 더욱 흉포해집니다! (공격력 증가)"
    },
    {
      "trigger": "HP_BELOW_20",
      "type": "LOGIC_FLEE",
      "chance": 0.5,
      "msg": "겁에 질린 늑대들이 꼬리를 내리고 도망칩니다."
    }
  ],
  "rewards": {
    "xp": 50,
    "items": ["ITEM_WOLF_PELT", "ITEM_MEAT"]
  }
}
```

### 5.2 AI 생성 가이드라인

1.  **Tag Consistency**: 이름에 '얼음'이 들어가면 반드시 `ATTR_ICE` 태그와 `WEAK_FIRE` 태그를 부여할 것.
2.  **Stat Balancing**:
    - `EASY`: 플레이어 HP의 10% 데미지.
    - `NORMAL`: 15% 데미지.
    - `HARD`: 25% 데미지 + 상태이상.
    - `NIGHTMARE`: 40% 데미지 + 치명타 확률 대폭 증가.
