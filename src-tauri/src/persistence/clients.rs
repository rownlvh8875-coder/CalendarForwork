#[cfg(test)]
mod tests {
    use crate::persistence::{master_types::NewClientRecord, Database};
    use std::{thread, time::Duration};

    fn sample_client(name: &str) -> NewClientRecord {
        NewClientRecord {
            name: name.into(),
            category: Some("공공기관".into()),
            department: Some("철도사업본부".into()),
            contact_name: Some("홍길동".into()),
            phone: Some("02-0000-0000".into()),
            email: Some("contact@example.invalid".into()),
            memo: Some("발주처 업무 메모".into()),
        }
    }

    #[test]
    fn client_crud_round_trips_all_fields() {
        let db = Database::open_in_memory().unwrap();
        let input = sample_client("국가철도공단");
        let created = db.create_client(input.clone()).unwrap();
        assert_eq!(created.client, input);

        let loaded = db.get_client(&created.id).unwrap().unwrap();
        assert_eq!(loaded, created);

        thread::sleep(Duration::from_millis(5));
        let mut replacement = created.client.clone();
        replacement.department = Some("건설본부".into());
        replacement.memo = None;
        let updated = db.replace_client(&created.id, replacement.clone()).unwrap();
        assert_eq!(updated.client, replacement);
        assert_eq!(updated.created_at, created.created_at);
        assert_ne!(updated.updated_at, created.updated_at);

        db.create_client(sample_client("A 발주기관")).unwrap();
        let clients = db.list_clients().unwrap();
        assert_eq!(clients.len(), 2);
        assert_eq!(clients[0].client.name, "A 발주기관");

        db.remove_client(&created.id).unwrap();
        assert!(db.get_client(&created.id).unwrap().is_none());
    }

    #[test]
    fn deleting_client_nulls_linked_project_without_deleting_project() {
        let db = Database::open_in_memory().unwrap();
        let client = db.create_client(sample_client("발주처 A")).unwrap();
        {
            let connection = db.lock().unwrap();
            connection.execute(
                "INSERT INTO projects (id, name, client_id, current_stage, priority, archived, created_at, updated_at)
                 VALUES ('project-1', 'A철도 차량기지 건설공사', ?1, 'interest', 'normal', 0,
                         strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [&client.id],
            ).unwrap();
        }

        db.remove_client(&client.id).unwrap();
        let connection = db.lock().unwrap();
        let client_id: Option<String> = connection
            .query_row("SELECT client_id FROM projects WHERE id='project-1'", [], |row| row.get(0))
            .unwrap();
        let project_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM projects WHERE id='project-1'", [], |row| row.get(0))
            .unwrap();
        assert!(client_id.is_none());
        assert_eq!(project_count, 1);
    }
}
