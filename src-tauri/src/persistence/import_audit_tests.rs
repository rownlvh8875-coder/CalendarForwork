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
