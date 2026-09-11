use crate::persistence::{
    master_types::{NewProjectRecord, ProjectRecord, ProjectStageRecord},
    Database, PersistenceResult,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const PROJECT_SELECT: &str = "
SELECT
  p.id, p.project_code, p.name, p.client_id, c.name AS client_name,
  p.project_type, p.region, p.contract_type, p.estimated_cost,
  p.current_stage, p.priority, p.assignee, p.expected_bid_date,
  p.description, p.memo, p.url, p.archived, p.created_at, p.updated_at
FROM projects p
LEFT JOIN clients c ON c.id = p.client_id";

fn map_project_row(row: &Row<'_>) -> rusqlite::Result<ProjectRecord> {
    Ok(ProjectRecord {
        id: row.get(0)?,
        project: NewProjectRecord {
            project_code: row.get(1)?,
            name: row.get(2)?,
            client_id: row.get(3)?,
            project_type: row.get(5)?,
            region: row.get(6)?,
            contract_type: row.get(7)?,
            estimated_cost: row.get(8)?,
            current_stage: row.get(9)?,
            priority: row.get(10)?,
            assignee: row.get(11)?,
            expected_bid_date: row.get(12)?,
            description: row.get(13)?,
            memo: row.get(14)?,
            url: row.get(15)?,
            archived: row.get::<_, i64>(16)? != 0,
        },
        client_name: row.get(4)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

fn get_project_from_connection(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<Option<ProjectRecord>> {
    connection
        .query_row(
            &format!("{PROJECT_SELECT} WHERE p.id = ?1"),
            [id],
            map_project_row,
        )
        .optional()
}

fn current_timestamp(connection: &Connection) -> rusqlite::Result<String> {
    connection.query_row(
        "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        [],
        |row| row.get(0),
    )
}

impl Database {
    pub fn list_project_stages(&self) -> PersistenceResult<Vec<ProjectStageRecord>> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(
            "SELECT key, name, sort_order, is_active
             FROM project_stages
             WHERE is_active = 1
             ORDER BY sort_order ASC, key ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(ProjectStageRecord {
                key: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn list_projects(&self, include_archived: bool) -> PersistenceResult<Vec<ProjectRecord>> {
        let connection = self.lock()?;
        let where_clause = if include_archived { "" } else { "WHERE p.archived = 0" };
        let sql = format!(
            "{PROJECT_SELECT}
             {where_clause}
             ORDER BY
               p.archived ASC,
               CASE WHEN p.expected_bid_date IS NULL OR p.expected_bid_date = '' THEN 1 ELSE 0 END ASC,
               p.expected_bid_date ASC,
               CASE p.priority
                 WHEN 'critical' THEN 0
                 WHEN 'high' THEN 1
                 WHEN 'normal' THEN 2
                 WHEN 'low' THEN 3
                 ELSE 4
               END ASC,
               p.name COLLATE NOCASE ASC,
               p.created_at ASC,
               p.id ASC"
        );
        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map([], map_project_row)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn get_project(&self, id: &str) -> PersistenceResult<Option<ProjectRecord>> {
        let connection = self.lock()?;
        Ok(get_project_from_connection(&connection, id)?)
    }

    pub fn create_project(&self, input: NewProjectRecord) -> PersistenceResult<ProjectRecord> {
        let id = Uuid::new_v4().to_string();
        let history_id = Uuid::new_v4().to_string();
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let timestamp = current_timestamp(&transaction)?;

        transaction.execute(
            "INSERT INTO projects (
                id, project_code, name, client_id, project_type, region, contract_type,
                estimated_cost, current_stage, priority, assignee, expected_bid_date,
                description, memo, url, archived, created_at, updated_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?17
             )",
            params![
                id,
                input.project_code.as_deref(),
                input.name.as_str(),
                input.client_id.as_deref(),
                input.project_type.as_deref(),
                input.region.as_deref(),
                input.contract_type.as_deref(),
                input.estimated_cost,
                input.current_stage.as_str(),
                input.priority.as_str(),
                input.assignee.as_deref(),
                input.expected_bid_date.as_deref(),
                input.description.as_deref(),
                input.memo.as_deref(),
                input.url.as_deref(),
                input.archived as i64,
                timestamp.as_str(),
            ],
        )?;

        transaction.execute(
            "INSERT INTO project_stage_history(
                id, project_id, from_stage, to_stage, changed_at, source, note, created_at
             ) VALUES (?1, ?2, NULL, ?3, ?4, 'project-create', NULL, ?4)",
            params![history_id, id, input.current_stage.as_str(), timestamp.as_str()],
        )?;

        let created = get_project_from_connection(&transaction, &id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        transaction.commit()?;
        Ok(created)
    }

    pub fn replace_project(
        &self,
        id: &str,
        input: NewProjectRecord,
    ) -> PersistenceResult<ProjectRecord> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let existing = get_project_from_connection(&transaction, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let previous_stage = existing.project.current_stage.clone();
        let stage_changed = previous_stage != input.current_stage;
        let timestamp = current_timestamp(&transaction)?;

        let changed = transaction.execute(
            "UPDATE projects SET
                project_code = ?1,
                name = ?2,
                client_id = ?3,
                project_type = ?4,
                region = ?5,
                contract_type = ?6,
                estimated_cost = ?7,
                current_stage = ?8,
                priority = ?9,
                assignee = ?10,
                expected_bid_date = ?11,
                description = ?12,
                memo = ?13,
                url = ?14,
                archived = ?15,
                updated_at = ?16
             WHERE id = ?17",
            params![
                input.project_code.as_deref(),
                input.name.as_str(),
                input.client_id.as_deref(),
                input.project_type.as_deref(),
                input.region.as_deref(),
                input.contract_type.as_deref(),
                input.estimated_cost,
                input.current_stage.as_str(),
                input.priority.as_str(),
                input.assignee.as_deref(),
                input.expected_bid_date.as_deref(),
                input.description.as_deref(),
                input.memo.as_deref(),
                input.url.as_deref(),
                input.archived as i64,
                timestamp.as_str(),
                id,
            ],
        )?;

        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows.into());
        }

        if stage_changed {
            let history_id = Uuid::new_v4().to_string();
            transaction.execute(
                "INSERT INTO project_stage_history(
                    id, project_id, from_stage, to_stage, changed_at, source, note, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, 'project-edit', NULL, ?5)",
                params![
                    history_id,
                    id,
                    previous_stage.as_str(),
                    input.current_stage.as_str(),
                    timestamp.as_str(),
                ],
            )?;
        }

        let updated = get_project_from_connection(&transaction, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        transaction.commit()?;
        Ok(updated)
    }

    pub fn set_project_archived(
        &self,
        id: &str,
        archived: bool,
    ) -> PersistenceResult<ProjectRecord> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE projects
             SET archived = ?1,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?2",
            params![archived as i64, id],
        )?;

        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows.into());
        }

        get_project_from_connection(&connection, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }
}

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
        assert_eq!(stages.len(), 17);
        assert_eq!(stages[0].key, "interest");
        assert_eq!(stages[0].name, "관심사업");
        assert_eq!(stages[16].key, "cancelled");
        assert_eq!(stages[16].name, "취소");

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
