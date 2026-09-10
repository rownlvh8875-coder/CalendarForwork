mod commands;
mod persistence;

#[cfg(test)]
mod commands_contract_tests;

use std::path::{Path, PathBuf};

use persistence::Database;
use tauri::Manager;

fn app_database_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("calendarforwork.sqlite3")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let database = Database::open(app_database_path(&app_data_dir))?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::events::events_list_between,
            commands::events::events_list_upcoming,
            commands::events::events_get,
            commands::events::events_create,
            commands::events::events_replace,
            commands::events::events_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CalendarForwork");
}
