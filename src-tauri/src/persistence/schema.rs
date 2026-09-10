use rusqlite::Connection;

const MIGRATION_1: &str = r#"
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NULL,
  project_name TEXT NULL,
  client_name TEXT NULL,
  category_id TEXT NOT NULL,
  category_key TEXT NOT NULL,
  category_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NULL,
  deadline_at TEXT NULL,
  all_day INTEGER NOT NULL CHECK (all_day IN (0, 1)),
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee TEXT NULL,
  location TEXT NULL,
  url TEXT NULL,
  memo TEXT NULL,
  is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
  completed_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_deadline_at ON events(deadline_at);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
"#;

pub fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    let transaction = connection.unchecked_transaction()?;

    transaction.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    let current_version: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if current_version < 1 {
        transaction.execute_batch(MIGRATION_1)?;
        transaction.execute(
            "INSERT INTO schema_migrations(version, applied_at)
             VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
            [],
        )?;
    }

    transaction.commit()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migration_creates_events_table() {
        let connection = Connection::open_in_memory().unwrap();
        migrate(&connection).unwrap();

        let table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='events'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 1);
    }

    #[test]
    fn migration_v2_creates_project_and_client_master_tables() {
        let connection = Connection::open_in_memory().unwrap();
        migrate(&connection).unwrap();

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);

        for table in ["clients", "project_stages", "projects"] {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "missing table {table}");
        }

        let stage_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM project_stages", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stage_count, 17);

        migrate(&connection).unwrap();
        let stage_count_after_second_run: i64 = connection
            .query_row("SELECT COUNT(*) FROM project_stages", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stage_count_after_second_run, 17);
    }
}
