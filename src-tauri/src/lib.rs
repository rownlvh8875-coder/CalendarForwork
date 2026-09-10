mod persistence;

#[cfg(test)]
mod commands_contract_tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running CalendarForwork");
}
