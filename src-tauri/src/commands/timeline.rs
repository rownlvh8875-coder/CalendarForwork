use crate::persistence::{
    timeline_types::ProjectStageHistoryRecord,
    Database,
};

#[tauri::command]
pub fn project_stage_history_list(
    database: tauri::State<'_, Database>,
    project_id: String,
) -> Result<Vec<ProjectStageHistoryRecord>, String> {
    database
        .list_project_stage_history(&project_id)
        .map_err(|error| error.to_string())
}
