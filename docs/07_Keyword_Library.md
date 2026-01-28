# 🏷️ 07. Keyword & Tag Library (Extended)

시스템의 언어이자, AI와 게임 엔진을 연결하는 태그 사전입니다.
약 150+개의 키워드가 정의되어 있으며, 프롬프트 주입 시 이 중에서 적절한 태그가 선별되어 사용됩니다.

## 1. 개체 타입 (Entity Types)

### 1.1 생물형 (Biological)

- `TAG_HUMANOID`: 인간형. 심리 상태이상에 취약. 도구 사용 가능.
- `TAG_BEAST`: 야수. 불(`ATTR_FIRE`)이나 소음에 민감. 본능적 행동.
- `TAG_INSECT`: 곤충. `SWARM`(무리) 속성을 자주 가짐. 불에 약함(1.5x).
- `TAG_PLANT`: 식물. 불에 극도로 취약(2.0x). 물 공격 시 회복. 이동 불가(대부분).
- `TAG_DRAGON`: 용. 최상위 포식자. 하위 등급 상태이상 면역.
- `TAG_GIANT`: 거인. 넉백/기절 저항. 명중률 낮음.

### 1.2 비생물/불사형 (Non-Bio / Undead)

- `TAG_UNDEAD`: 언데드. 독/출혈/질병 면역. 신성(`ATTR_HOLY`)에 치명적 약점. 힐=데미지.
- `TAG_DULLAHAN`: 머리 없는 기사. 헤드샷 불가. 공포 면역.
- `TAG_CONSTRUCT`: 기계/골렘. 정신계 면역. 전기(`ATTR_LIGHTNING`) 약점. 방어력 높음.
- `TAG_ELEMENTAL`: 정령. 물리 피해 반감. 역속성 공격에만 100% 피해.
- `TAG_SPIRIT`: 영체. 물리 회피 50%. 마법 피해 1.2배.

### 1.3 초월적 존재 (Eldritch & Divine)

- `TAG_DEMON`: 악마. 신성 약점. 어둠 면역. 계약(Pact) 제안 가능.
- `TAG_CELESTIAL`: 천사/신성. 암흑 약점. 빛/화염 면역.
- `TAG_ABERRATION`: 이형의 존재(크툴루 계열). 조우 시 `SANITY` 감소. 이해 불가한 행동.

---

## 2. 속성 (Elements & Attributes)

### 2.1 기초 4원소

- `ATTR_FIRE`: 화염. `STATUS_BURN`. 얼음/식물 카운터.
- `ATTR_WATER`: 물. 불 끄기. 전기 전도율 높임(`STATUS_WET`).
- `ATTR_ICE`: 냉기. `STATUS_FREEZE` / `STATUS_CHILL`. 물 얼림.
- `ATTR_EARTH`: 대지. 둔탁함. 비행 유닛에게 명중률 낮음. `STATUS_PETRIFY`(석화).

### 2.2 상위 속성

- `ATTR_LIGHTNING`: 전기. `STATUS_SHOCK`. 기계/물 젖은 적에게 치명타.
- `ATTR_WIND`: 바람. 투사체 반사/회피 증가. 낙사 유발.
- `ATTR_POISON`: 독. `STATUS_POISON`. 지속 피해.
- `ATTR_ACID`: 산성. `STATUS_CORROSION`(방어력 영구 감소).

### 2.3 차원 속성

- `ATTR_HOLY`: 신성. 언데드/악마 추뎀. 치유 효과 증폭.
- `ATTR_DARK`: 암흑. `STATUS_CURSE`. 시야 차단. 공포 유발.
- `ATTR_VOID`: 공허. 방어력 무시 고정 피해. 존재 소멸.
- `ATTR_BLOOD`: 혈액. `STATUS_BLEED`. 체력 흡수(Lifesteal).
- `ATTR_SOUND`: 음파. 유리/결정체 파괴. `STATUS_STUN`.

---

## 3. 상태이상 (Status Effects)

### 3.1 제어 불가 (Crowd Control)

- `STATUS_STUN`: 기절. 1턴간 행동 불가. 회피율 0.
- `STATUS_SLEEP`: 수면. 깨어나기 전까지 행동 불가. 피격 시 +50% 피해 입고 해제.
- `STATUS_FREEZE`: 빙결. 행동 불가. 물리 피격 시 깨짐(추가 피해). 화염으로 즉시 해제.
- `STATUS_ROOT`: 속박. 이동 불가. 원거리 공격/마법은 가능.
- `STATUS_SILENCE`: 침묵. 마법/스킬 사용 불가. 평타만 가능.
- `STATUS_CHARM`: 매혹. 아군 공격 불가능. 시전자에게 힐/버프 줄 수도 있음.
- `STATUS_PETRIFY`: 석화. 영구 행동 불가(사망 처리). 방어력 무한대. 해제 마법 필요.

### 3.2 지속 피해 및 디버프 (DoT / Debuff)

- `STATUS_BURN`: 화상. 턴 종료 시 최대 체력 비례 피해. 회복 효과 50% 반감.
- `STATUS_HEAVY_BURN`: 중화상. 화상의 2배 피해. 전염됨.
- `STATUS_POISON`: 중독. 턴마다 고정 피해. 스택 가능.
- `STATUS_TOXIC`: 맹독. 턴마다 피해량 2배씩 증가(1, 2, 4, 8...).
- `STATUS_BLEED`: 출혈. 행동(공격/이동) 할 때마다 피해.
- `STATUS_ROTTING`: 부패. 최대 HP가 점차 감소. 치료 불가.
- `STATUS_BLIND`: 실명. 명중률 50% 감소.
- `STATUS_WEAK`: 약화. 공격력 30% 감소.
- `STATUS_VULNERABLE`: 취약. 받는 피해 30% 증가.
- `STATUS_SLOW`: 감속. 속도(SPD) 50% 감소. 턴 밀림.
- `STATUS_FEAR`: 공포. 50% 확률로 턴 넘김(아무것도 못함).

### 3.3 정신계 (Mental / Sanity)

- `STATUS_CONFUSION`: 혼란. 타겟팅 랜덤(아군/적군/자신).
- `STATUS_BERSERK`: 광란. 공격력 50% 증가, 방어력 50% 감소. 제어 불가(자동 공격).
- `STATUS_DESPAIR`: 절망. MP 지속 감소. MP 0 되면 자해.

---

## 4. AI 행동 로직 (Action Logic Tags)

AI(NPC/Monster)의 행동 패턴을 결정하는 태그입니다.

### 4.1 타겟팅 우선순위

- `TARGET_LOWEST_HP`: 체력이 가장 낮은 적 노림 (막타).
- `TARGET_HIGHEST_ATK`: 공격력이 가장 센 적 노림 (위협 제거).
- `TARGET_HEALER`: 회복 스킬 가진 적 우선 공격.
- `TARGET_REAR`: 후열(Ranger/Mage) 우선 공격.
- `TARGET_RANDOM`: 무작위 공격 (예: 광전사, 슬라임).

### 4.2 스킬 사용 조건

- `LOGIC_HEAL_SELF_30`: 체력 30% 이하일 때 자가 회복.
- `LOGIC_ENRAGE_50`: 체력 50% 이하일 때 광폭화(Buff) 시전.
- `LOGIC_SUMMON_DEATH`: 사망 시 쫄몹 소환.
- `LOGIC_FLEE_LOW_HP`: 체력 10% 이하일 때 도주 시도.
- `LOGIC_COUNTER_MAGIC`: 마법 공격 받으면 즉시 반격.

---

## 5. 지형 및 환경 (Environment)

- `ENV_DARKNESS`: 암흑. 횃불 필요. 명중률 -20%, 피습 확률 증가.
- `ENV_MIST`: 안개. 원거리 공격 명중률 -50%.
- `ENV_UNDERWATER`: 수중. 호흡 제한. 전기 피해 2배. 화염 피해 반감.
- `ENV_MAGMA`: 용암 지대. 매 턴 화염 피해.
- `ENV_HOLY_GROUND`: 성소. 매 턴 체력 회복. 언데드 진입 시 지속 피해.
- `ENV_MIASMA`: 독기. 턴마다 중독 스택 쌓임.
- `ENV_MAGNETIC_FIELD`: 자기장. 금속 장비 착용자 속도 감소.
- `ENV_NARROW`: 좁은 통로. 대형 무기 휘두르기 불리(공격력 감소). 전열 1명만 전투 가능.
