use crate::persistence::{
    master_types::{ClientRecord, NewClientRecord},
    Database,
};

#[tauri::command]
pub fn clients_list(database: tauri::State<'_, Database>) -> Result<Vec<ClientRecord>, String> {
    database.list_clients().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clients_get(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<Option<ClientRecord>, String> {
    database.get_client(&id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clients_create(
    database: tauri::State<'_, Database>,
    client: NewClientRecord,
) -> Result<ClientRecord, String> {
    database
        .create_client(client)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clients_replace(
    database: tauri::State<'_, Database>,
    id: String,
    client: NewClientRecord,
) -> Result<ClientRecord, String> {
    database
        .replace_client(&id, client)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clients_remove(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<(), String> {
    database.remove_client(&id).map_err(|error| error.to_string())
}
