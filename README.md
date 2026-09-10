# CalendarForwork

토목영업 업무에 특화된 달력형 일정관리 프로그램입니다.

## 개발 방향

- **V1:** Windows 개인 PC용 로컬 데스크톱 앱
- **V2+:** 토목영업팀 다중 사용자 / 서버 기반 협업형 시스템으로 확장
- UI/UX를 핵심 품질로 두고, 일정·사업·발주처·입찰 단계 정보를 한 화면에서 빠르게 파악할 수 있도록 설계합니다.

## V1 핵심 기능

- 월간 / 주간 / 목록형 캘린더
- 오늘 업무 대시보드
- 사업별 일정 Timeline
- 입찰공고 / PQ / SOQ / 현장설명 / 설계 / 설계심의 / 가격입찰 / 개찰 / 발주예정 / 회의 / 보고 / 제출 일정 분류
- D-Day 및 마감 임박 표시
- 일정 등록 / 수정 / 삭제 / Drag & Drop
- 중요도 / 진행상태 / 담당자 / 메모 / URL / 첨부파일 관리
- 사업 및 발주처 관리
- 통합검색 / 필터
- Excel Import / Export
- Windows 알림
- SQLite 자동백업 / 복원
- Light / Dark Mode

## 권장 기술 스택

- **Frontend:** React + TypeScript
- **Desktop Runtime:** Tauri
- **Local DB:** SQLite
- **Architecture:** UI → Service → Repository Interface → SQLite Repository

향후 팀 버전에서는 Repository 구현을 API 기반으로 교체하여 UI와 핵심 업무로직을 최대한 재사용합니다.

## 설계 문서

- [`docs/superpowers/specs/2026-09-10-calendar-for-work-design.md`](docs/superpowers/specs/2026-09-10-calendar-for-work-design.md)

## 현재 상태

**Design Phase — V1 제품/화면/데이터 구조 확정 중**
