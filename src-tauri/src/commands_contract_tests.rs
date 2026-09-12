use std::path::Path;

use crate::{
    app_database_path,
    commands::{
        clients::{clients_create, clients_get, clients_list, clients_remove, clients_replace},
        events::{
            events_create, events_get, events_list_between, events_list_by_project,
            events_list_upcoming, events_remove, events_replace,
        },
        projects::{
            project_stages_list, projects_create, projects_get, projects_list,
            projects_replace, projects_set_archived,
        },
        timeline::project_stage_history_list,
    },
};

#[test]
fn app_database_path_uses_calendarforwork_filename() {
    let path = app_database_path(Path::new("C:/Users/test/AppData/Roaming/com.calendarforwork.desktop"));
    assert_eq!(path.file_name().unwrap(), "calendarforwork.sqlite3");
}

#[test]
fn event_command_entrypoints_are_exposed() {
    let _ = events_list_between;
    let _ = events_list_upcoming;
    let _ = events_list_by_project;
    let _ = events_get;
    let _ = events_create;
    let _ = events_replace;
    let _ = events_remove;
}

#[test]
fn master_command_entrypoints_are_exposed() {
    let _ = clients_list;
    let _ = clients_get;
    let _ = clients_create;
    let _ = clients_replace;
    let _ = clients_remove;

    let _ = project_stages_list;
    let _ = projects_list;
    let _ = projects_get;
    let _ = projects_create;
    let _ = projects_replace;
    let _ = projects_set_archived;
}

#[test]
fn project_timeline_command_entrypoint_is_exposed() {
    let _ = project_stage_history_list;
}

#[test]
fn excel_runtime_dependencies_are_linked() {
    let _ = tauri_plugin_dialog::init;
    let _ = rust_xlsxwriter::Workbook::new;
    let _ = std::any::type_name::<calamine::Data>();
}
