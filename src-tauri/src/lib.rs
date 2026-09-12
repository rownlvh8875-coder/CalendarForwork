mod commands;
mod excel;
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
        .plugin(tauri_plugin_dialog::init())
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
            commands::events::events_list_by_project,
            commands::events::events_get,
            commands::events::events_create,
            commands::events::events_replace,
            commands::events::events_remove,
            commands::clients::clients_list,
            commands::clients::clients_get,
            commands::clients::clients_create,
            commands::clients::clients_replace,
            commands::clients::clients_remove,
            commands::projects::project_stages_list,
            commands::projects::projects_list,
            commands::projects::projects_get,
            commands::projects::projects_create,
            commands::projects::projects_replace,
            commands::projects::projects_set_archived,
            commands::timeline::project_stage_history_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CalendarForwork");
}
