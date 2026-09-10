use crate::persistence::{
    types::{EventRecord, NewEventRecord},
    Database, PersistenceResult,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const EVENT_SELECT: &str = "
SELECT
  id, project_id, project_name, client_name,
  category_id, category_key, category_name, title, description,
  start_at, end_at, deadline_at, all_day, status, priority,
  assignee, location, url, memo, is_pinned, completed_at,
  created_at, updated_at
FROM events";

fn map_event_row(row: &Row<'_>) -> rusqlite::Result<EventRecord> {
    Ok(EventRecord {
        id: row.get(0)?,
        event: NewEventRecord {
            project_id: row.get(1)?,
            project_name: row.get(2)?,
            client_name: row.get(3)?,
            category_id: row.get(4)?,
            category_key: row.get(5)?,
            category_name: row.get(6)?,
            title: row.get(7)?,
            description: row.get(8)?,
            start_at: row.get(9)?,
            end_at: row.get(10)?,
            deadline_at: row.get(11)?,
            all_day: row.get::<_, i64>(12)? != 0,
            status: row.get(13)?,
            priority: row.get(14)?,
            assignee: row.get(15)?,
            location: row.get(16)?,
            url: row.get(17)?,
            memo: row.get(18)?,
            is_pinned: row.get::<_, i64>(19)? != 0,
            completed_at: row.get(20)?,
        },
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
    })
}

fn get_event_from_connection(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<Option<EventRecord>> {
    connection
        .query_row(
            &format!("{EVENT_SELECT} WHERE id = ?1"),
            [id],
            map_event_row,
        )
        .optional()
}

impl Database {
    pub fn get_event(&self, id: &str) -> PersistenceResult<Option<EventRecord>> {
        let connection = self.lock()?;
        Ok(get_event_from_connection(&connection, id)?)
    }

    pub fn list_events_between(
        &self,
        start_iso: &str,
        end_iso: &str,
    ) -> PersistenceResult<Vec<EventRecord>> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(&format!(
            "{EVENT_SELECT}
             WHERE substr(start_at, 1, 10) >= substr(?1, 1, 10)
               AND substr(start_at, 1, 10) <= substr(?2, 1, 10)
             ORDER BY start_at ASC, created_at ASC, id ASC"
        ))?;
        let rows = statement.query_map(params![start_iso, end_iso], map_event_row)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn create_event(&self, input: NewEventRecord) -> PersistenceResult<EventRecord> {
        let id = Uuid::new_v4().to_string();
        let connection = self.lock()?;
        connection.execute(
            "INSERT INTO events (
                id, project_id, project_name, client_name,
                category_id, category_key, category_name, title, description,
                start_at, end_at, deadline_at, all_day, status, priority,
                assignee, location, url, memo, is_pinned, completed_at,
                created_at, updated_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21,
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                id,
                input.project_id.as_deref(),
                input.project_name.as_deref(),
                input.client_name.as_deref(),
                input.category_id.as_str(),
                input.category_key.as_str(),
                input.category_name.as_str(),
                input.title.as_str(),
                input.description.as_deref(),
                input.start_at.as_str(),
                input.end_at.as_deref(),
                input.deadline_at.as_deref(),
                input.all_day as i64,
                input.status.as_str(),
                input.priority.as_str(),
                input.assignee.as_deref(),
                input.location.as_deref(),
                input.url.as_deref(),
                input.memo.as_deref(),
                input.is_pinned as i64,
                input.completed_at.as_deref(),
            ],
        )?;

        get_event_from_connection(&connection, &id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }

    pub fn replace_event(
        &self,
        id: &str,
        input: NewEventRecord,
    ) -> PersistenceResult<EventRecord> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE events SET
                project_id = ?1,
                project_name = ?2,
                client_name = ?3,
                category_id = ?4,
                category_key = ?5,
                category_name = ?6,
                title = ?7,
                description = ?8,
                start_at = ?9,
                end_at = ?10,
                deadline_at = ?11,
                all_day = ?12,
                status = ?13,
                priority = ?14,
                assignee = ?15,
                location = ?16,
                url = ?17,
                memo = ?18,
                is_pinned = ?19,
                completed_at = ?20,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?21",
            params![
                input.project_id.as_deref(),
                input.project_name.as_deref(),
                input.client_name.as_deref(),
                input.category_id.as_str(),
                input.category_key.as_str(),
                input.category_name.as_str(),
                input.title.as_str(),
                input.description.as_deref(),
                input.start_at.as_str(),
                input.end_at.as_deref(),
                input.deadline_at.as_deref(),
                input.all_day as i64,
                input.status.as_str(),
                input.priority.as_str(),
                input.assignee.as_deref(),
                input.location.as_deref(),
                input.url.as_deref(),
                input.memo.as_deref(),
                input.is_pinned as i64,
                input.completed_at.as_deref(),
                id,
            ],
        )?;

        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows.into());
        }

        get_event_from_connection(&connection, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }

    pub fn remove_event(&self, id: &str) -> PersistenceResult<()> {
        let connection = self.lock()?;
        connection.execute("DELETE FROM events WHERE id = ?1", [id])?;
        Ok(())
    }
}

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
