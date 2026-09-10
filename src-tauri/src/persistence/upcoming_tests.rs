use crate::persistence::{types::NewEventRecord, Database};

fn sample_event(title: &str, start_at: &str) -> NewEventRecord {
    NewEventRecord {
        project_id: None,
        project_name: None,
        client_name: None,
        category_id: "other".into(),
        category_key: "other".into(),
        category_name: "기타".into(),
        title: title.into(),
        description: None,
        start_at: start_at.into(),
        end_at: None,
        deadline_at: None,
        all_day: false,
        status: "planned".into(),
        priority: "normal".into(),
        assignee: None,
        location: None,
        url: None,
        memo: None,
        is_pinned: false,
        completed_at: None,
    }
}

#[test]
fn list_upcoming_matches_memory_repository_calendar_day_window() {
    let db = Database::open_in_memory().unwrap();
    db.create_event(sample_event("오늘", "2026-09-10T09:00:00+09:00")).unwrap();
    db.create_event(sample_event("D+3", "2026-09-13T09:00:00+09:00")).unwrap();
    db.create_event(sample_event("범위밖", "2026-09-14T09:00:00+09:00")).unwrap();

    let events = db
        .list_upcoming("2026-09-10T18:00:00+09:00", 3)
        .unwrap();
    let titles = events
        .iter()
        .map(|event| event.event.title.as_str())
        .collect::<Vec<_>>();

    assert_eq!(titles, vec!["오늘", "D+3"]);
}

#[test]
fn list_upcoming_clamps_negative_days_to_today() {
    let db = Database::open_in_memory().unwrap();
    db.create_event(sample_event("오늘", "2026-09-10T09:00:00+09:00")).unwrap();
    db.create_event(sample_event("내일", "2026-09-11T09:00:00+09:00")).unwrap();

    let events = db
        .list_upcoming("2026-09-10T18:00:00+09:00", -2)
        .unwrap();

    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event.title, "오늘");
}
