# 🌟 01. Concept & Overview

## 1. 프로젝트 개요

- **Project Name**: AI Text Dungeon (가칭: Dungeon Prompt)
- **Genre**: UGC (User Generated Content) Text Roguelite RPG
- **Platform**: Web (Mobile First Responsive)
- **Core Tech**: React, Firebase, Google Gemini 2.5 Flash

## 2. 핵심 철학 (Core Pillars)

### 🧩 Create (창조)

사용자는 코딩이나 툴 학습 없이, **자연어 대화(Prompting)**만으로 자신만의 던전을 창조합니다.

- "얼음 동굴에 사는 거대한 예티를 만들어줘." -> 실제 게임형 카드로 변환.

### ⚔️ Play (공략)

다른 유저가 만든 던전에 도전합니다. 로그라이크(Roguelite) 요소를 차용하여 매번 새로운 경험을 제공합니다.

- 죽으면 던전 내 아이템 소실 (로그라이크)
- 얻은 재화로 로비에서 영구적 성장 (메타 진행)

### 🎨 Visualize (시각화)

생성형 이미지(Stable Diffusion 등)에 의존하지 않습니다.
대신 **고풍스러운 타이포그래피(Typography), 텍스처(Texture), UI 인터랙션, 사운드**로 플레이어의 상상력을 자극하는 "Text-High-Fidelity"를 지향합니다.

## 3. 타겟 오디언스

1.  **TRPG/D&D 팬**: 텍스트와 상상력으로 진행되는 서사를 즐기는 유저.
2.  **크리에이터 성향 게이머**: 자신의 설정놀이(World Building)를 남들에게 보여주고 피드백 받고 싶은 욕구.
3.  **웹 게임 유저**: 설치 없이 클릭만으로 즐기는 가벼운 접근성을 선호하는 유저.

## 4. 디자인 언어 (Design Code)

- **Theme**: `Dark Fantasy`, `Arcane`, `Ancient`
- **Colors**: Deep Blue (`#0a0a0c`), Royal Purple (`#5b21b6`), Gold (`#ffd700`), Blood Red (`#991b1b`)
- **Typography**: `Cinzel` (제목/강조), `Noto Serif KR` (본문/서사)
- **Atmosphere**: 어둡고 무겁지만, 마법적인 효과(Glow)로 신비감을 조성.

## 5. 차별화 포인트

기존 텍스트 RPG와의 가장 큰 차이점은 **"AI가 DM(Dungeon Master) 역할을 수행하지만, 룰은 엄격한 시스템(Code)이 통제한다"**는 점입니다.
AI는 서사와 묘사를 담당하고, 전투 결과와 보상 계산은 결정론적인 코드 로직이 담당하여 **게임으로서의 공정성과 전략성**을 보장합니다.
