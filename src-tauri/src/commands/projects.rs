use crate::persistence::{
    master_types::{NewProjectRecord, ProjectRecord, ProjectStageRecord},
    Database,
};

#[tauri::command]
pub fn project_stages_list(
    database: tauri::State<'_, Database>,
) -> Result<Vec<ProjectStageRecord>, String> {
    database
        .list_project_stages()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn projects_list(
    database: tauri::State<'_, Database>,
    include_archived: bool,
) -> Result<Vec<ProjectRecord>, String> {
    database
        .list_projects(include_archived)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn projects_get(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<Option<ProjectRecord>, String> {
    database.get_project(&id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn projects_create(
    database: tauri::State<'_, Database>,
    project: NewProjectRecord,
) -> Result<ProjectRecord, String> {
    database
        .create_project(project)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn projects_replace(
    database: tauri::State<'_, Database>,
    id: String,
    project: NewProjectRecord,
) -> Result<ProjectRecord, String> {
    database
        .replace_project(&id, project)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn projects_set_archived(
    database: tauri::State<'_, Database>,
    id: String,
    archived: bool,
) -> Result<ProjectRecord, String> {
    database
        .set_project_archived(&id, archived)
        .map_err(|error| error.to_string())
}
