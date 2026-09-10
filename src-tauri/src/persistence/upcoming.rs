use crate::persistence::{Database, PersistenceResult};
use rusqlite::params;

impl Database {
    pub fn list_upcoming(
        &self,
        from_iso: &str,
        days: i64,
    ) -> PersistenceResult<Vec<crate::persistence::types::EventRecord>> {
        let days = days.max(0);
        let end_key: String = {
            let connection = self.lock()?;
            connection.query_row(
                "SELECT date(substr(?1, 1, 10), printf('+%d days', ?2))",
                params![from_iso, days],
                |row| row.get(0),
            )?
        };

        self.list_events_between(from_iso, &end_key)
    }
}
