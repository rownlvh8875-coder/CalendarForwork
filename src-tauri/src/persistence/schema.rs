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

const MIGRATION_2: &str = r#"
CREATE TABLE IF NOT EXISTS project_stages (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NULL,
  department TEXT NULL,
  contact_name TEXT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  memo TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  project_code TEXT NULL,
  name TEXT NOT NULL,
  client_id TEXT NULL REFERENCES clients(id) ON DELETE SET NULL,
  project_type TEXT NULL,
  region TEXT NULL,
  contract_type TEXT NULL,
  estimated_cost INTEGER NULL,
  current_stage TEXT NOT NULL DEFAULT 'interest' REFERENCES project_stages(key),
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee TEXT NULL,
  expected_bid_date TEXT NULL,
  description TEXT NULL,
  memo TEXT NULL,
  url TEXT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code
ON projects(project_code) WHERE project_code IS NOT NULL AND project_code <> '';
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_projects_expected_bid_date ON projects(expected_bid_date);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

INSERT OR IGNORE INTO project_stages(key, name, sort_order, is_active) VALUES
  ('interest', '관심사업', 10, 1),
  ('planning', '계획', 20, 1),
  ('planned-order', '발주예정', 30, 1),
  ('notice', '입찰공고', 40, 1),
  ('pq', 'PQ', 50, 1),
  ('soq', 'SOQ', 60, 1),
  ('basic-design', '기본설계', 70, 1),
  ('detailed-design', '실시설계', 80, 1),
  ('design-review', '설계심의', 90, 1),
  ('price-bid', '가격입찰', 100, 1),
  ('opening', '개찰', 110, 1),
  ('preferred-bidder', '우선협상', 120, 1),
  ('won', '수주', 130, 1),
  ('lost', '탈락', 140, 1),
  ('hold', '보류', 150, 1),
  ('closed', '종료', 160, 1),
  ('cancelled', '취소', 170, 1);
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

    if current_version < 2 {
        transaction.execute_batch(MIGRATION_2)?;
        transaction.execute(
            "INSERT INTO schema_migrations(version, applied_at)
             VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
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
    fn migration_creates_project_and_client_master_tables() {
        let connection = Connection::open_in_memory().unwrap();
        migrate(&connection).unwrap();

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 3);

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

    #[test]
    fn migration_v3_backfills_one_current_stage_baseline_per_existing_project() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                );",
            )
            .unwrap();
        connection.execute_batch(MIGRATION_1).unwrap();
        connection.execute_batch(MIGRATION_2).unwrap();
        connection
            .execute_batch(
                "INSERT INTO schema_migrations(version, applied_at) VALUES
                    (1, '2026-09-11T00:00:00.000Z'),
                    (2, '2026-09-11T00:00:01.000Z');
                 INSERT INTO projects(
                    id, name, current_stage, priority, archived, created_at, updated_at
                 ) VALUES (
                    'legacy-project', '기존 사업', 'pq', 'normal', 0,
                    '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z'
                 );",
            )
            .unwrap();

        migrate(&connection).unwrap();

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 3);

        let table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='project_stage_history'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 1);

        let baseline = connection
            .query_row(
                "SELECT id, from_stage, to_stage, source
                 FROM project_stage_history
                 WHERE project_id = 'legacy-project'",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(baseline.0, "baseline:legacy-project");
        assert_eq!(baseline.1, None);
        assert_eq!(baseline.2, "pq");
        assert_eq!(baseline.3, "migration-baseline");

        migrate(&connection).unwrap();
        let baseline_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM project_stage_history WHERE project_id = 'legacy-project'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(baseline_count, 1);
    }
}
