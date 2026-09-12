use crate::persistence::{schema, Database};
use rusqlite::Connection;

#[test]
fn migration_v4_creates_import_audit_tables() {
    let db = Database::open_in_memory().unwrap();
    let connection = db.lock().unwrap();

    let version: i64 = connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
        .unwrap();
    assert_eq!(version, 4);

    for table in ["import_batches", "import_rows"] {
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "missing table {table}");
    }
}

#[test]
fn migration_v4_is_idempotent() {
    let connection = Connection::open_in_memory().unwrap();
    connection.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

    schema::migrate(&connection).unwrap();
    schema::migrate(&connection).unwrap();

    let version_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = 4",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(version_count, 1);
}

#[test]
fn import_audit_lifecycle_tracks_started_completed_and_failed_batches() {
    let db = Database::open_in_memory().unwrap();

    let completed = db
        .start_import_batch("projects", "projects.xlsx", "사업")
        .and_then(|batch| {
            db.complete_import_batch(&batch.id, 10, 7, 1, 1, 1)
        })
        .unwrap();
    assert_eq!(completed.status, "completed");
    assert_eq!(completed.total_rows, 10);
    assert_eq!(completed.imported_rows, 7);
    assert_eq!(completed.duplicate_rows, 1);
    assert_eq!(completed.invalid_rows, 1);
    assert_eq!(completed.skipped_rows, 1);
    assert!(completed.completed_at.is_some());

    let failed = db
        .start_import_batch("events", "events.xlsx", "일정")
        .and_then(|batch| db.fail_import_batch(&batch.id, "database-error"))
        .unwrap();
    assert_eq!(failed.status, "failed");
    assert_eq!(failed.error_message.as_deref(), Some("database-error"));
    assert!(failed.completed_at.is_some());
}

#[test]
fn import_audit_schema_rejects_invalid_status_and_cascades_rows() {
    let db = Database::open_in_memory().unwrap();
    let batch = db
        .start_import_batch("projects", "projects.xlsx", "사업")
        .unwrap();

    {
        let connection = db.lock().unwrap();
        let invalid = connection.execute(
            "INSERT INTO import_rows(
                id, batch_id, source_row_number, status, created_at
             ) VALUES ('invalid-row', ?1, 2, 'ready', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
            [&batch.id],
        );
        assert!(invalid.is_err());

        connection
            .execute(
                "INSERT INTO import_rows(
                    id, batch_id, source_row_number, status, created_at
                 ) VALUES ('row-1', ?1, 2, 'imported', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [&batch.id],
            )
            .unwrap();
        connection
            .execute("DELETE FROM import_batches WHERE id = ?1", [&batch.id])
            .unwrap();
        let row_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM import_rows", [], |row| row.get(0))
            .unwrap();
        assert_eq!(row_count, 0);
    }
}

#[test]
fn failed_batch_can_be_recorded_after_domain_transaction_rollback() {
    let db = Database::open_in_memory().unwrap();
    let batch = db
        .start_import_batch("projects", "rollback.xlsx", "사업")
        .unwrap();

    {
        let mut connection = db.lock().unwrap();
        let tx = connection.transaction().unwrap();
        tx.execute(
            "INSERT INTO clients(id, name, created_at, updated_at)
             VALUES ('temporary-client', '임시 발주처',
                     strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                     strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
            [],
        )
        .unwrap();
        tx.rollback().unwrap();
    }

    let failed = db
        .fail_import_batch(&batch.id, "forced rollback")
        .unwrap();
    assert_eq!(failed.status, "failed");

    let connection = db.lock().unwrap();
    let client_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE id = 'temporary-client'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(client_count, 0);
    let status: String = connection
        .query_row(
            "SELECT status FROM import_batches WHERE id = ?1",
            [&batch.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "failed");
}
