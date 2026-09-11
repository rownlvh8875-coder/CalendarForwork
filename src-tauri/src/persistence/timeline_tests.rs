use crate::persistence::{
    master_types::{NewClientRecord, NewProjectRecord},
    types::NewEventRecord,
    Database,
};

fn sample_project(name: &str, code: &str, stage: &str) -> NewProjectRecord {
    NewProjectRecord {
        project_code: Some(code.into()),
        name: name.into(),
        client_id: None,
        project_type: Some("철도".into()),
        region: Some("서울".into()),
        contract_type: Some("기술형입찰".into()),
        estimated_cost: Some(100_000_000_000),
        current_stage: stage.into(),
        priority: "high".into(),
        assignee: Some("담당자".into()),
        expected_bid_date: Some("2027-03-15".into()),
        description: None,
        memo: None,
        url: None,
        archived: false,
    }
}

fn sample_client(name: &str) -> NewClientRecord {
    NewClientRecord {
        name: name.into(),
        category: Some("공공기관".into()),
        department: None,
        contact_name: None,
        phone: None,
        email: None,
        memo: None,
    }
}

fn sample_event(project_id: Option<&str>, title: &str, start_at: &str) -> NewEventRecord {
    NewEventRecord {
        project_id: project_id.map(str::to_string),
        project_name: None,
        client_name: None,
        category_id: "category-pq".into(),
        category_key: "pq".into(),
        category_name: "PQ".into(),
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
fn project_create_records_one_initial_stage_history() {
    let db = Database::open_in_memory().unwrap();
    let created = db
        .create_project(sample_project("신규 사업", "NEW-1", "planned-order"))
        .unwrap();

    let history = db.list_project_stage_history(&created.id).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].from_stage, None);
    assert_eq!(history[0].to_stage, "planned-order");
    assert_eq!(history[0].source, "project-create");
}

#[test]
fn project_replace_records_only_real_stage_changes() {
    let db = Database::open_in_memory().unwrap();
    let created = db
        .create_project(sample_project("단계 사업", "STAGE-1", "planned-order"))
        .unwrap();

    let mut same_stage = created.project.clone();
    same_stage.memo = Some("메모만 수정".into());
    db.replace_project(&created.id, same_stage).unwrap();
    assert_eq!(db.list_project_stage_history(&created.id).unwrap().len(), 1);

    let mut changed = created.project.clone();
    changed.current_stage = "pq".into();
    db.replace_project(&created.id, changed).unwrap();

    let history = db.list_project_stage_history(&created.id).unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].from_stage.as_deref(), Some("planned-order"));
    assert_eq!(history[0].to_stage, "pq");
    assert_eq!(history[0].source, "project-edit");
}

#[test]
fn failed_stage_change_leaves_project_and_history_unchanged() {
    let db = Database::open_in_memory().unwrap();
    let created = db
        .create_project(sample_project("롤백 사업", "ROLLBACK-1", "planned-order"))
        .unwrap();

    let mut invalid = created.project.clone();
    invalid.current_stage = "missing-stage".into();
    assert!(db.replace_project(&created.id, invalid).is_err());

    let after = db.get_project(&created.id).unwrap().unwrap();
    assert_eq!(after.project.current_stage, "planned-order");
    let history = db.list_project_stage_history(&created.id).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].to_stage, "planned-order");
}

#[test]
fn archive_and_client_removal_preserve_project_stage_history() {
    let db = Database::open_in_memory().unwrap();
    let client = db.create_client(sample_client("발주처 A")).unwrap();
    let mut input = sample_project("이력 보존 사업", "KEEP-HISTORY", "pq");
    input.client_id = Some(client.id.clone());
    let created = db.create_project(input).unwrap();

    db.set_project_archived(&created.id, true).unwrap();
    assert_eq!(db.list_project_stage_history(&created.id).unwrap().len(), 1);

    db.remove_client(&client.id).unwrap();
    let project = db.get_project(&created.id).unwrap().unwrap();
    assert!(project.project.archived);
    assert!(project.project.client_id.is_none());

    let history = db.list_project_stage_history(&created.id).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].source, "project-create");
    assert_eq!(history[0].to_stage, "pq");
}

#[test]
fn list_events_by_project_returns_only_matching_events_in_start_order() {
    let db = Database::open_in_memory().unwrap();
    let project_a = db
        .create_project(sample_project("A사업", "A-1", "pq"))
        .unwrap();
    let project_b = db
        .create_project(sample_project("B사업", "B-1", "pq"))
        .unwrap();

    db.create_event(sample_event(
        Some(&project_a.id),
        "A 나중 일정",
        "2026-10-02T09:00:00+09:00",
    ))
    .unwrap();
    db.create_event(sample_event(
        Some(&project_a.id),
        "A 먼저 일정",
        "2026-09-20T09:00:00+09:00",
    ))
    .unwrap();
    db.create_event(sample_event(
        Some(&project_b.id),
        "B 일정",
        "2026-09-10T09:00:00+09:00",
    ))
    .unwrap();
    db.create_event(sample_event(
        None,
        "미연결 일정",
        "2026-09-01T09:00:00+09:00",
    ))
    .unwrap();

    let rows = db.list_events_by_project(&project_a.id).unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].event.title, "A 먼저 일정");
    assert_eq!(rows[1].event.title, "A 나중 일정");
    assert!(rows
        .iter()
        .all(|event| event.event.project_id.as_deref() == Some(project_a.id.as_str())));
}
