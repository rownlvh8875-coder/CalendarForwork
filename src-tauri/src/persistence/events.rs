#[cfg(test)]
mod tests {
    use crate::persistence::{types::NewEventRecord, Database};
    use std::{thread, time::Duration};

    fn sample_event(title: &str, start_at: &str) -> NewEventRecord {
        NewEventRecord {
            project_id: Some("project-rail-1".into()),
            project_name: Some("A철도 차량기지 건설공사".into()),
            client_name: Some("국가철도공단".into()),
            category_id: "pq".into(),
            category_key: "pq".into(),
            category_name: "PQ".into(),
            title: title.into(),
            description: Some("입찰참가자격 사전심사".into()),
            start_at: start_at.into(),
            end_at: Some("2026-09-10T18:00:00+09:00".into()),
            deadline_at: Some("2026-09-10T17:00:00+09:00".into()),
            all_day: false,
            status: "planned".into(),
            priority: "critical".into(),
            assignee: Some("담당자".into()),
            location: Some("본사".into()),
            url: Some("https://example.invalid/project".into()),
            memo: Some("제출서류 최종 검토".into()),
            is_pinned: true,
            completed_at: None,
        }
    }

    #[test]
    fn event_survives_database_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("calendarforwork.sqlite3");
        let input = sample_event("PQ 제출", "2026-09-10T09:00:00+09:00");

        let created_id = {
            let db = Database::open(&path).unwrap();
            let created = db.create_event(input.clone()).unwrap();
            assert_eq!(created.event, input);
            created.id
        };

        let reopened = Database::open(&path).unwrap();
        let event = reopened.get_event(&created_id).unwrap().unwrap();
        assert_eq!(event.event.title, "PQ 제출");
        assert_eq!(event.event.client_name.as_deref(), Some("국가철도공단"));
        assert_eq!(event.event.memo.as_deref(), Some("제출서류 최종 검토"));
    }

    #[test]
    fn list_between_includes_both_boundary_dates() {
        let db = Database::open_in_memory().unwrap();
        db.create_event(sample_event("월초", "2026-09-01T00:00:00+09:00"))
            .unwrap();
        db.create_event(sample_event("월말", "2026-09-30T23:59:00+09:00"))
            .unwrap();

        let events = db
            .list_events_between("2026-09-01", "2026-09-30")
            .unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event.title, "월초");
        assert_eq!(events[1].event.title, "월말");
    }

    #[test]
    fn replacing_event_preserves_created_at_and_refreshes_updated_at() {
        let db = Database::open_in_memory().unwrap();
        let created = db
            .create_event(sample_event("원래 일정", "2026-09-10T09:00:00+09:00"))
            .unwrap();
        let created_at = created.created_at.clone();
        let previous_updated_at = created.updated_at.clone();
        thread::sleep(Duration::from_millis(5));

        let mut replacement = created.event.clone();
        replacement.title = "수정 일정".into();
        replacement.status = "completed".into();
        replacement.completed_at = Some("2026-09-10T12:00:00+09:00".into());

        let updated = db.replace_event(&created.id, replacement).unwrap();
        assert_eq!(updated.created_at, created_at);
        assert_ne!(updated.updated_at, previous_updated_at);
        assert_eq!(updated.event.title, "수정 일정");
        assert_eq!(updated.event.status, "completed");
    }

    #[test]
    fn removing_event_is_permanent() {
        let db = Database::open_in_memory().unwrap();
        let created = db
            .create_event(sample_event("삭제 일정", "2026-09-10T09:00:00+09:00"))
            .unwrap();

        db.remove_event(&created.id).unwrap();
        assert!(db.get_event(&created.id).unwrap().is_none());
    }
}
