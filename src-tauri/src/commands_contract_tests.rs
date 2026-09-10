use std::path::Path;

use crate::{
    app_database_path,
    commands::events::{
        events_create, events_get, events_list_between, events_list_upcoming, events_remove,
        events_replace,
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
    let _ = events_get;
    let _ = events_create;
    let _ = events_replace;
    let _ = events_remove;
}
