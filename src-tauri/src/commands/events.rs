use crate::persistence::{
    types::{EventRecord, NewEventRecord},
    Database,
};

#[tauri::command]
pub fn events_list_between(
    database: tauri::State<'_, Database>,
    start_iso: String,
    end_iso: String,
) -> Result<Vec<EventRecord>, String> {
    database
        .list_events_between(&start_iso, &end_iso)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn events_list_upcoming(
    database: tauri::State<'_, Database>,
    from_iso: String,
    days: i64,
) -> Result<Vec<EventRecord>, String> {
    database
        .list_upcoming(&from_iso, days)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn events_get(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<Option<EventRecord>, String> {
    database.get_event(&id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn events_create(
    database: tauri::State<'_, Database>,
    event: NewEventRecord,
) -> Result<EventRecord, String> {
    database
        .create_event(event)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn events_replace(
    database: tauri::State<'_, Database>,
    id: String,
    event: NewEventRecord,
) -> Result<EventRecord, String> {
    database
        .replace_event(&id, event)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn events_remove(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<(), String> {
    database.remove_event(&id).map_err(|error| error.to_string())
}
