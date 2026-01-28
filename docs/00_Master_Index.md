# 📂 AI Text Dungeon - Documentation Index

이 폴더는 [AI Text Dungeon] 프로젝트의 모든 기획, 설계, 기술 문서를 관리하는 중앙 저장소입니다.
단일 파일(`plan.md`)의 복잡도를 줄이고, 각 도메인별로 명확한 명세를 제공하기 위해 분리되었습니다.

## 📑 문서 목록

### 1. [01_Concept_Overview.md](./01_Concept_Overview.md)

> **"어떤 게임인가?"**
> 게임의 핵심 컨셉, 타겟 오디언스, 디자인 언어(Visual & Audio) 등 프로젝트의 비전을 정의합니다.

### 2. [02_Gameplay_Systems.md](./02_Gameplay_Systems.md)

> **"어떻게 플레이하는가?"**
> 게임 루프(Loop), 전투 역학(Combat Mechanics), 스탯 공식, 속성 상성, 상태이상, 유물 시스템 등 핵심 게임 플레이 로직을 상세히 기술합니다.

### 3. [03_Data_Schema.md](./03_Data_Schema.md)

> **"데이터는 어떻게 생겼는가?"**
> Gemini AI가 생성할 Card JSON 스키마, Firestore 데이터베이스 모델, 태그(Keyword) 시스템 등 데이터 구조를 정의합니다.

### 4. [04_Development_Roadmap.md](./04_Development_Roadmap.md)

> **"언제 무엇을 만드는가?"**
> Phase 1(완료), Phase 2(진행 중), Phase 3(예정)의 상세 개발 체크리스트입니다.

### 5. [05_Hero_System.md](./05_Hero_System.md)

> **"누가 모험을 떠나는가?"**
> 영웅(플레이어)의 직업(Class), 6대 스탯(HP/MP/ATK...), UI 흐름 및 성장 방식을 정의합니다.

### 6. [06_Builder_System.md](./06_Builder_System.md)

> **"어떻게 만드는가?"**
> 직관적인 Drag & Drop 인터페이스, 3단계 카테고리 선택(Primary -> Sub -> Prompt), 덱(Deck) 시스템 등 Builder UI/UX 명세.

### 7. [07_Keyword_Library.md](./07_Keyword_Library.md)

> **"시스템의 언어 (Expanded)"**
> 100개 이상의 종족(Types), 속성(Elements), 상태이상(Status), AI 로직(AI Logic), 환경(Environment) 태그 집대성.

### 8. [Card Details (Folder)](./cards/00_Card_Index.md)

> **"카드의 모든 것"**
> 몬스터, 함정, 보물 등 각 카드 카테고리별 상세 작동 원리 및 스펙 문서 모음.

### 9. [08_Play_Interaction.md](./08_Play_Interaction.md)

> **"손맛과 연출"**
> 텍스트 & 클릭 기반이지만, 어떻게 타격감을 주고 상황별 버튼(Contextual Action)을 제공할지에 대한 UX 정의.

---

_Last Updated: 2026-01-26_
