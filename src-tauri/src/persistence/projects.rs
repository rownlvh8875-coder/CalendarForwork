#[cfg(test)]
mod tests {
    use crate::persistence::{
        master_types::{NewClientRecord, NewProjectRecord},
        Database,
    };
    use std::{thread, time::Duration};

    fn sample_client() -> NewClientRecord {
        NewClientRecord {
            name: "공공 발주처 A".into(),
            category: Some("공공기관".into()),
            department: None,
            contact_name: None,
            phone: None,
            email: None,
            memo: None,
        }
    }

    fn sample_project(name: &str, code: &str, client_id: Option<String>) -> NewProjectRecord {
        NewProjectRecord {
            project_code: Some(code.into()),
            name: name.into(),
            client_id,
            project_type: Some("철도".into()),
            region: Some("경기".into()),
            contract_type: Some("기술형입찰".into()),
            estimated_cost: Some(1_250_000_000_000),
            current_stage: "planned-order".into(),
            priority: "high".into(),
            assignee: Some("영업담당자".into()),
            expected_bid_date: Some("2027-03-15".into()),
            description: Some("A철도 차량기지 건설공사 설명".into()),
            memo: Some("입찰 준비 메모".into()),
            url: Some("https://example.invalid/project-a".into()),
            archived: false,
        }
    }

    #[test]
    fn project_round_trips_all_fields_and_joins_client_name() {
        let db = Database::open_in_memory().unwrap();
        let client = db.create_client(sample_client()).unwrap();
        let input = sample_project("A철도 차량기지 건설공사", "RAIL-A", Some(client.id));

        let created = db.create_project(input.clone()).unwrap();
        assert_eq!(created.project, input);
        assert_eq!(created.client_name.as_deref(), Some("공공 발주처 A"));

        let loaded = db.get_project(&created.id).unwrap().unwrap();
        assert_eq!(loaded, created);

        let stages = db.list_project_stages().unwrap();
        assert_eq!(stages.len(), 16);
        assert_eq!(stages[0].key, "interest");
        assert_eq!(stages[0].name, "관심사업");

        thread::sleep(Duration::from_millis(5));
        let mut replacement = created.project.clone();
        replacement.name = "A철도 차량기지 건설공사 변경".into();
        replacement.current_stage = "pq".into();
        replacement.memo = None;
        let updated = db.replace_project(&created.id, replacement.clone()).unwrap();
        assert_eq!(updated.project, replacement);
        assert_eq!(updated.client_name.as_deref(), Some("공공 발주처 A"));
        assert_eq!(updated.created_at, created.created_at);
        assert_ne!(updated.updated_at, created.updated_at);
    }

    #[test]
    fn project_constraints_reject_unknown_stage_and_duplicate_code() {
        let db = Database::open_in_memory().unwrap();
        let mut invalid_stage = sample_project("잘못된 단계", "INVALID-STAGE", None);
        invalid_stage.current_stage = "not-a-stage".into();
        assert!(db.create_project(invalid_stage).is_err());

        db.create_project(sample_project("첫 사업", "DUP-CODE", None))
            .unwrap();
        assert!(db
            .create_project(sample_project("중복 사업", "DUP-CODE", None))
            .is_err());
    }

    #[test]
    fn archiving_project_hides_it_from_active_list_but_keeps_history() {
        let db = Database::open_in_memory().unwrap();
        let kept = db
            .create_project(sample_project("진행 사업", "ACTIVE-1", None))
            .unwrap();
        let archived_target = db
            .create_project(sample_project("보관 사업", "ARCHIVE-1", None))
            .unwrap();

        let archived = db
            .set_project_archived(&archived_target.id, true)
            .unwrap();
        assert!(archived.project.archived);

        let active = db.list_projects(false).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, kept.id);

        let with_archived = db.list_projects(true).unwrap();
        assert_eq!(with_archived.len(), 2);
        assert!(with_archived
            .iter()
            .any(|project| project.id == archived_target.id && project.project.archived));
    }
}
