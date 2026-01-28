# ⚔️ 02. Gameplay Systems

## 1. 게임 루프 (Game Loop)

### 🔄 Meta Loop (던전 밖)

1.  **Lobby (Hub)**: 유저는 자신의 캐릭터(계정)를 관리합니다.
    - 기초 능력치 강화 (Passive Upgrades)
    - 직업 해금 (Warrior, Rogue, Mage)
2.  **Builder**: AI와 대화하며 던전(카드 덱)을 생성하고 게시합니다.
3.  **Reward**: 던전을 클리어하면 `Gold`와 `Essence`를 획득하여 계정을 성장시킵니다.

### 🔄 In-Game Loop (던전 안)

1.  **Entry**: 1레벨 + 기본 장비 + (선택한 유물)로 입장.
2.  **Explore**: 방(Room) 단위로 이동. 각 방은 `Enemy`, `Trap`, `Event` 중 하나.
3.  **Encounter**: 카드와 상호작용 (전투 또는 선택).
4.  **Growth**: 몬스터 처치 -> 레벨업/파밍 (해당 던전 내에서만 유효).
5.  **Result**:
    - **Success**: 보스 처치. 획득한 아이템을 재화로 환산하여 탈출.
    - **Failure**: 사망. 획득한 아이템 소실. 약간의 위로금(소량의 Gold)만 획득.

---

## 2. 전투 시스템 (Combat Mechanics)

### 📊 캐릭터 스탯 (Stats)

| 스탯 키 | 명칭   | 설명                                        |
| :------ | :----- | :------------------------------------------ |
| **HP**  | 체력   | 0이 되면 사망(패배).                        |
| **MP**  | 정신력 | 스킬 자원. 0이 되면 `CONFUSION`(혼란) 상태. |
| **ATK** | 공격력 | 기본 물리/마법 피해량.                      |
| **DEF** | 방어력 | 받는 데미지 감소량.                         |
| **SPD** | 속도   | 턴 획득 순서 및 회피율(Evasion) 보정.       |
| **LUK** | 행운   | 치명타(Crit), 드랍률, 상태이상 저항 확률.   |

### 🧮 데미지 공식 (Damage Formula)

```javascript
FinalDamage =
  Attacker_ATK * Skill_Multiplier * Attribute_Factor - Defender_DEF * 0.5;
FinalDamage = Math.max(1, FinalDamage); // 최소 데미지 1 보장
```

### 💧 속성 상성 (Attribute System)

- **약점 (Weakness)**: 데미지 **1.5배 ~ 2.0배**
- **저항 (Resistance)**: 데미지 **0.5배**
- **면역 (Immunity)**: 데미지 0 또는 상태이상 무효

**[주요 속성 태그]**

- `ATTR_FIRE` (화염) ↔ `ATTR_ICE` (냉기)
- `ATTR_HOLY` (신성) ↔ `ATTR_DARK` (암흑) / `TAG_UNDEAD`
- `ATTR_LIGHTNING` (전기) → `TAG_CONSTRUCT` (기계)에 강함

---

## 3. 이벤트 및 함정 (Events & Traps)

전투 외에도 다양한 태그 기반 상호작용이 존재합니다.

- **함정 (Traps)**
  - `CARD_TRAP_INSTANT`: 밟자마자 발동 (예: 화살 함정). `SPD` 기반 회피 판정.
  - `CARD_TRAP_ROOM`: 방 전체에 디버프 부여 (예: 독안개). 해제 불가 시 지속 피해.
- **보물 (Treasures)**
  - `CARD_LOOT_CHEST`: 열쇠(`ITEM_KEY`)가 필요하거나, `LUK` 스탯으로 잠금 해제 시도.
  - 실패 시 `MIMIC`(미믹)으로 변신하여 전투 발생 가능성.

## 4. 플레이어 성장 (Progression)

- **XP (Experience)**: 몬스터 처치 시 획득. 일정량 도달 시 레벨업.
  - 레벨업 시: 전체 HP/MP 회복 + 스탯 포인트 선택 보너스.
- **Equipment**: 무기(Weapon), 방어구(Armor), 장신구(Accessory) 슬롯.
  - 장비는 던전 내에서만 유지되며, 탈출 시 소멸(로그라이크 룰).
