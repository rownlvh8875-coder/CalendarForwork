use std::collections::BTreeMap;

use crate::persistence::{
    master_types::{NewClientRecord, NewProjectRecord},
    Database,
};

use super::{
    projects::{commit_project_rows, validate_project_rows, ProjectImportRow},
    types::ImportRowStatus,
};

fn row(source_row_number: usize, fields: &[(&str, &str)]) -> ProjectImportRow {
    ProjectImportRow {
        source_row_number,
        fields: fields
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect::<BTreeMap<_, _>>(),
    }
}

fn client(name: &str) -> NewClientRecord {
    NewClientRecord {
        name: name.into(),
        category: None,
        department: None,
        contact_name: None,
        phone: None,
        email: None,
        memo: None,
    }
}

fn existing_project(name: &str, code: Option<&str>, client_id: Option<String>) -> NewProjectRecord {
    NewProjectRecord {
        project_code: code.map(str::to_string),
        name: name.into(),
        client_id,
        project_type: None,
        region: None,
        contract_type: None,
        estimated_cost: None,
        current_stage: "interest".into(),
        priority: "normal".into(),
        assignee: None,
        expected_bid_date: None,
        description: None,
        memo: None,
        url: None,
        archived: false,
    }
}

#[test]
fn project_validation_applies_defaults_and_reports_value_errors() {
    let db = Database::open_in_memory().unwrap();
    let rows = vec![
        row(2, &[("name", "  정상 사업  ")]),
        row(3, &[("name", "   ")]),
        row(4, &[("name", "단계 오류"), ("current_stage", "임의단계")]),
        row(5, &[("name", "금액 오류"), ("estimated_cost", "약 삼천억원")]),
        row(6, &[("name", "날짜 오류"), ("expected_bid_date", "03/04/26")]),
    ];

    let validation = validate_project_rows(&db, &rows).unwrap();
    assert_eq!(validation.total_rows, 5);
    assert_eq!(validation.ready_rows, 1);
    assert_eq!(validation.invalid_rows, 4);

    let ready = &validation.rows[0];
    assert_eq!(ready.status, ImportRowStatus::Ready);
    let normalized = ready.normalized.as_ref().unwrap();
    assert_eq!(normalized.name, "정상 사업");
    assert_eq!(normalized.current_stage, "interest");
    assert_eq!(normalized.priority, "normal");
    assert!(!normalized.archived);

    for expected in ["required-name", "invalid-stage", "invalid-amount", "invalid-date"] {
        assert!(validation
            .rows
            .iter()
            .any(|item| item.issues.iter().any(|issue| issue == expected)),
            "missing issue {expected}");
    }
}

#[test]
fn project_validation_detects_existing_and_batch_duplicates_and_ambiguous_clients() {
    let db = Database::open_in_memory().unwrap();
    let agency = db.create_client(client("기존 발주처")).unwrap();
    db.create_project(existing_project(
        "기존 사업",
        Some("EXIST-1"),
        Some(agency.id.clone()),
    ))
    .unwrap();

    db.create_client(client("중복이름 발주처")).unwrap();
    db.create_client(client("중복이름 발주처")).unwrap();

    let rows = vec![
        row(2, &[("project_code", "EXIST-1"), ("name", "코드 중복")]),
        row(3, &[("name", "기존 사업"), ("client_name", "기존 발주처")]),
        row(4, &[("name", "기존 사업")]),
        row(5, &[("project_code", "BATCH-1"), ("name", "배치 첫 사업")]),
        row(6, &[("project_code", "BATCH-1"), ("name", "배치 코드 중복")]),
        row(7, &[("name", "신규 사업"), ("client_name", "중복이름 발주처")]),
    ];

    let validation = validate_project_rows(&db, &rows).unwrap();
    assert_eq!(validation.duplicate_rows, 4);
    assert_eq!(validation.ready_rows, 1);
    assert_eq!(validation.invalid_rows, 1);

    assert!(validation.rows[2]
        .issues
        .iter()
        .any(|issue| issue.contains("possible-duplicate")));
    assert_eq!(validation.rows[4].status, ImportRowStatus::Duplicate);
    assert!(validation.rows[5]
        .issues
        .iter()
        .any(|issue| issue == "ambiguous-client"));
}

#[test]
fn project_commit_reuses_new_client_and_records_one_create_history_per_project() {
    let db = Database::open_in_memory().unwrap();
    let rows = vec![
        row(
            2,
            &[
                ("project_code", "NEW-A"),
                ("name", "신규 A사업"),
                ("client_name", "신규 공동 발주처"),
                ("estimated_cost", "3,200억원"),
                ("current_stage", "발주예정"),
                ("priority", "높음"),
                ("expected_bid_date", "2027.03.15"),
            ],
        ),
        row(
            3,
            &[
                ("project_code", "NEW-B"),
                ("name", "신규 B사업"),
                ("client_name", "신규 공동 발주처"),
            ],
        ),
    ];

    let batch = commit_project_rows(&db, "projects.xlsx", "사업", &rows).unwrap();
    assert_eq!(batch.status, "completed");
    assert_eq!(batch.total_rows, 2);
    assert_eq!(batch.imported_rows, 2);

    let connection = db.lock().unwrap();
    let client_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE name = '신규 공동 발주처'",
            [],
            |result| result.get(0),
        )
        .unwrap();
    assert_eq!(client_count, 1);

    let project_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE project_code IN ('NEW-A', 'NEW-B')",
            [],
            |result| result.get(0),
        )
        .unwrap();
    assert_eq!(project_count, 2);

    let distinct_clients: i64 = connection
        .query_row(
            "SELECT COUNT(DISTINCT client_id) FROM projects WHERE project_code IN ('NEW-A', 'NEW-B')",
            [],
            |result| result.get(0),
        )
        .unwrap();
    assert_eq!(distinct_clients, 1);

    let history_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM project_stage_history h
             JOIN projects p ON p.id = h.project_id
             WHERE p.project_code IN ('NEW-A', 'NEW-B') AND h.source = 'project-create'",
            [],
            |result| result.get(0),
        )
        .unwrap();
    assert_eq!(history_count, 2);

    let audit_rows: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM import_rows WHERE batch_id = ?1 AND status = 'imported'",
            [&batch.id],
            |result| result.get(0),
        )
        .unwrap();
    assert_eq!(audit_rows, 2);
}

#[test]
fn project_commit_rolls_back_domain_and_row_audit_then_marks_batch_failed() {
    let db = Database::open_in_memory().unwrap();
    {
        let connection = db.lock().unwrap();
        connection
            .execute_batch(
                "CREATE TRIGGER force_project_import_failure
                 BEFORE INSERT ON projects
                 WHEN NEW.name = '강제 실패'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced project import failure');
                 END;",
            )
            .unwrap();
    }

    let rows = vec![
        row(
            2,
            &[
                ("project_code", "ROLLBACK-A"),
                ("name", "먼저 생성될 사업"),
                ("client_name", "롤백 발주처"),
            ],
        ),
        row(
            3,
            &[
                ("project_code", "ROLLBACK-B"),
                ("name", "강제 실패"),
                ("client_name", "롤백 발주처"),
            ],
        ),
    ];

    assert!(commit_project_rows(&db, "rollback.xlsx", "사업", &rows).is_err());

    let connection = db.lock().unwrap();
    for sql in [
        "SELECT COUNT(*) FROM projects WHERE project_code LIKE 'ROLLBACK-%'",
        "SELECT COUNT(*) FROM clients WHERE name = '롤백 발주처'",
        "SELECT COUNT(*) FROM project_stage_history h JOIN projects p ON p.id=h.project_id WHERE p.project_code LIKE 'ROLLBACK-%'",
        "SELECT COUNT(*) FROM import_rows",
    ] {
        let count: i64 = connection.query_row(sql, [], |result| result.get(0)).unwrap();
        assert_eq!(count, 0, "rollback failed for {sql}");
    }

    let (status, error): (String, Option<String>) = connection
        .query_row(
            "SELECT status, error_message FROM import_batches
             WHERE source_file_name='rollback.xlsx'
             ORDER BY started_at DESC LIMIT 1",
            [],
            |result| Ok((result.get(0)?, result.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, "failed");
    assert!(error.unwrap_or_default().contains("forced project import failure"));
}
