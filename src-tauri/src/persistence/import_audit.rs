use crate::persistence::{Database, PersistenceResult};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBatchRecord {
    pub id: String,
    pub dataset: String,
    pub source_file_name: String,
    pub sheet_name: String,
    pub status: String,
    pub total_rows: i64,
    pub imported_rows: i64,
    pub duplicate_rows: i64,
    pub invalid_rows: i64,
    pub skipped_rows: i64,
    pub error_message: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

const IMPORT_BATCH_SELECT: &str = "
SELECT id, dataset, source_file_name, sheet_name, status,
       total_rows, imported_rows, duplicate_rows, invalid_rows, skipped_rows,
       error_message, started_at, completed_at
FROM import_batches";

fn map_import_batch_row(row: &Row<'_>) -> rusqlite::Result<ImportBatchRecord> {
    Ok(ImportBatchRecord {
        id: row.get(0)?,
        dataset: row.get(1)?,
        source_file_name: row.get(2)?,
        sheet_name: row.get(3)?,
        status: row.get(4)?,
        total_rows: row.get(5)?,
        imported_rows: row.get(6)?,
        duplicate_rows: row.get(7)?,
        invalid_rows: row.get(8)?,
        skipped_rows: row.get(9)?,
        error_message: row.get(10)?,
        started_at: row.get(11)?,
        completed_at: row.get(12)?,
    })
}

fn get_import_batch_from_connection(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<Option<ImportBatchRecord>> {
    connection
        .query_row(
            &format!("{IMPORT_BATCH_SELECT} WHERE id = ?1"),
            [id],
            map_import_batch_row,
        )
        .optional()
}

impl Database {
    pub fn start_import_batch(
        &self,
        dataset: &str,
        source_file_name: &str,
        sheet_name: &str,
    ) -> PersistenceResult<ImportBatchRecord> {
        let id = Uuid::new_v4().to_string();
        let connection = self.lock()?;
        connection.execute(
            "INSERT INTO import_batches(
                id, dataset, source_file_name, sheet_name, status, started_at
             ) VALUES (
                ?1, ?2, ?3, ?4, 'started', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![id, dataset, source_file_name, sheet_name],
        )?;

        get_import_batch_from_connection(&connection, &id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }

    pub fn complete_import_batch(
        &self,
        id: &str,
        total_rows: i64,
        imported_rows: i64,
        duplicate_rows: i64,
        invalid_rows: i64,
        skipped_rows: i64,
    ) -> PersistenceResult<ImportBatchRecord> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE import_batches SET
                status = 'completed',
                total_rows = ?1,
                imported_rows = ?2,
                duplicate_rows = ?3,
                invalid_rows = ?4,
                skipped_rows = ?5,
                error_message = NULL,
                completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?6 AND status = 'started'",
            params![
                total_rows,
                imported_rows,
                duplicate_rows,
                invalid_rows,
                skipped_rows,
                id,
            ],
        )?;

        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows.into());
        }

        get_import_batch_from_connection(&connection, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }

    pub fn fail_import_batch(
        &self,
        id: &str,
        error_message: &str,
    ) -> PersistenceResult<ImportBatchRecord> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE import_batches SET
                status = 'failed',
                error_message = ?1,
                completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?2 AND status = 'started'",
            params![error_message, id],
        )?;

        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows.into());
        }

        get_import_batch_from_connection(&connection, id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows.into())
    }
}
