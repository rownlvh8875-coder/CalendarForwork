use crate::persistence::{
    timeline_types::ProjectStageHistoryRecord,
    Database, PersistenceResult,
};
use rusqlite::Row;

fn map_history_row(row: &Row<'_>) -> rusqlite::Result<ProjectStageHistoryRecord> {
    Ok(ProjectStageHistoryRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        from_stage: row.get(2)?,
        to_stage: row.get(3)?,
        changed_at: row.get(4)?,
        source: row.get(5)?,
        note: row.get(6)?,
        created_at: row.get(7)?,
    })
}

impl Database {
    pub fn list_project_stage_history(
        &self,
        project_id: &str,
    ) -> PersistenceResult<Vec<ProjectStageHistoryRecord>> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(
            "SELECT id, project_id, from_stage, to_stage, changed_at, source, note, created_at
             FROM project_stage_history
             WHERE project_id = ?1
             ORDER BY changed_at DESC, created_at DESC, id DESC",
        )?;
        let rows = statement.query_map([project_id], map_history_row)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}
