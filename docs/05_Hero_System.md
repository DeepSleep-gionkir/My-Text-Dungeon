# 🦸 05. Hero System (Player Character)

## 1. 개요 (Overview)

플레이어는 던전에 입장할 때, 자신의 분신이 될 **'영웅(Hero)'**을 선택하거나 관리합니다.
모든 영웅은 기본적으로 1레벨로 던전에 입장하며, 던전 밖(Lobby)에서의 투자를 통해 **'기초 스탯(Base Stats)'**을 영구적으로 강화할 수 있습니다.

## 2. 유저 인터페이스 흐름 (UI/UX Flow)

### 2.1 HERO 탭 (Lobby)

- **Hero Dashboard**: 현재 선택된 영웅의 전신 일러스트(또는 아이콘)와 상세 스탯 레이더 차트 표시.
- **Management**: 장비하고 있는 `Perk`(유물) 및 `Skill` 확인.
- **Action**: `[Change Hero]`(캐릭터 선택하기) 버튼 배치.

### 2.2 캐릭터 선택 모드 (Selection Mode)

1.  **Card Layout**: 해금된 직업(Class)들이 '타로 카드' 형태의 그리드로 나열됨.
    - 미해금 직업은 자물쇠 아이콘과 실루엣 처리.
2.  **Interaction (Card Flip)**:
    - 카드를 클릭하면 3D 애니메이션으로 뒤집힘.
    - **Front**: 직업 이름, 대표 이미지.
    - **Back**: 상세 스탯(HP, MP 등), 고유 패시브(Unique Trait), 운용 난이도.
3.  **Confirmation**: 하단 `[Select]` 버튼을 눌러 영웅 확정.

## 3. 스탯 시스템 (Stats Architecture)

게임 밸런싱의 핵심이 되는 6대 스탯입니다.

| 스탯 (Abbr.) | 명칭                   | 설명 및 메커니즘                                                                                         | Default Logic           |
| :----------- | :--------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------- |
| **HP**       | 체력 (Health Points)   | 생명력. 0이 되면 사망 처리(패배).                                                                        | `Base + (Lvl * Growth)` |
| **MP**       | 정신력 (Mental Points) | 스킬 사용 자원. **0이 되면 `CONFUSION` 상태**에 빠져, 아군을 공격하거나 행동 불가.                       | `Base + (Int * Coeff)`  |
| **ATK**      | 공격력 (Attack)        | 물리/마법 피해의 기초값. 최종 데미지 계산의 핵심 변수.                                                   | `Base`                  |
| **DEF**      | 방어력 (Defense)       | 받는 피해를 감소시키는 수치. (공식: `Dmg = Atk - (Def * 0.5)`)                                           | `Base + Equip`          |
| **SPD**      | 속도 (Speed)           | 1. **턴 잡는 순서**: 높을수록 선공 확률 증가.<br>2. **회피율**: `(SPD - EnemyACC) * %` 확률로 완전 회피. | `Base`                  |
| **LUK**      | 행운 (Luck)            | 1. **치명타(Crit)** 확률.<br>2. **상태이상 저항** 확률.<br>3. **보물상자/함정** 해제 성공률.             | `Flat Value`            |

## 4. 직업 시스템 (Class System) - _Expanded_

플레이어의 성향에 맞춰 선택할 수 있는 6가지 기본 직업과 1가지 히든 직업을 제안합니다.

### 🛡️ 워리어 (Warrior)

- **Role**: 탱커 / 브루저
- **Stats**: `HP(High)`, `DEF(High)`, `MP(Low)`
- **Unique Trait**: **[Iron Will]**
  - HP가 30% 이하일 때, 받는 모든 피해가 **30% 감소**합니다.
  - 위기 상황에서 끈질기게 버티는 생존형 특성.

### 🗡️ 로그 (Rogue)

- **Role**: 암살자 / 파밍 전문가
- **Stats**: `SPD(High)`, `LUK(High)`, `HP(Low)`
- **Unique Trait**: **[Shadow Step]**
  - 전투 시작(1턴) 시 **100% 확률로 선공**을 잡고, 첫 공격이 **치명타**로 적중합니다.
  - 함정 해제 성공률 보정 (+20%).

### 🔮 메이지 (Mage)

- **Role**: 누커 (광역 딜러)
- **Stats**: `MP(Very High)`, `ATK(High)`, `DEF(Low)`
- **Unique Trait**: **[Mana Shield]**
  - 받는 피해의 40%를 HP 대신 **MP로 소모**하여 막아냅니다.
  - MP가 0이 되면 즉시 보호막이 깨지고 `Confusion` 상태에 빠지므로 관리가 필수.

### 🌿 레인저 (Ranger)

- **Role**: 원거리 딜러 / 탐험가
- **Stats**: `SPD(High)`, `ATK(Mid)`, `DEF(Mid)`
- **Unique Trait**: **[Eagle Eye]**
  - 모든 공격의 **명중률이 20% 증가**하며, 적의 '회피(Evasion)' 수치를 무시합니다.
  - 높은 회피율을 가진 적(영체, 암살자 등)을 잡는 데 특화.

### ✝️ 클레릭 (Cleric)

- **Role**: 유지력 / 언데드 슬레이어
- **Stats**: `MP(High)`, `DEF(Mid)`, `SPD(Low)`
- **Unique Trait**: **[Divine Grace]**
  - 턴 종료 시, 자신의 **최대 체력의 5%를 회복**합니다.
  - `TAG_UNDEAD` 속성 적에게 입히는 피해량 **+50%**.

### 🩸 워락 (Warlock)

- **Role**: 하이 리스크, 하이 리턴
- **Stats**: `ATK(Very High)`, `HP(High)`, `DEF(Very Low)`
- **Unique Trait**: **[Blood Pact]**
  - 스킬 사용 시 MP 대신 **HP를 소모**합니다.
  - 잃은 체력에 비례하여 마법 공격력이 증폭됩니다. (최대 50% 증댐)

### 🥚 프리랜서 (Freelancer) - _Hidden/Default_

- **Role**: 초보자 / 대기만성형
- **Stats**: 모든 스탯이 평균(Average).
- **Unique Trait**: **[Jack of All Trades]**
  - 모든 장비 착용 가능, 모든 스킬북 학습 가능.
  - 초반엔 약하지만, 어떤 유물을 얻느냐에 따라 무한한 가능성.

## 5. 성장 시스템 (Progression)

### 5.1 인게임 성장 (In-Dungeon)

- 몬스터 처치 시 `XP` 획득 -> 레벨 업.
- 레벨 업 시 `HP/MP` 완충 및 **임의의 스탯 3개 중 택1** 하여 강화.

### 5.2 메타 성장 (Meta-Progression)

- 던전에서 가져온 `Gold`를 소모하여 영웅의 **'초기 스탯(Base Stat)'**을 영구적으로 올릴 수 있음.
  - 예: `Warrior HP Lv.1` -> `Warrior HP Lv.2` (시작 HP +10)
