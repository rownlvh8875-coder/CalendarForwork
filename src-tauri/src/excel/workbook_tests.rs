use std::fs;

use rust_xlsxwriter::Workbook;
use tempfile::tempdir;

use super::workbook::{inspect_workbook, read_sheet_rows, ExcelWorkbookError};

fn write_sample_workbook(path: &std::path::Path, data_rows: usize) {
    let mut workbook = Workbook::new();

    let projects = workbook.add_worksheet();
    projects.set_name("사업").unwrap();
    projects.write_string(2, 0, "사업명").unwrap();
    projects.write_string(2, 1, "발주처").unwrap();
    for index in 0..data_rows {
        let row = 3 + index as u32;
        projects
            .write_string(row, 0, format!("가상 사업 {}", index + 1))
            .unwrap();
        projects
            .write_string(row, 1, "가상 발주처")
            .unwrap();
    }

    let events = workbook.add_worksheet();
    events.set_name("일정").unwrap();
    events.write_string(0, 0, "일정명").unwrap();
    events.write_string(0, 1, "날짜").unwrap();
    events.write_string(1, 0, "PQ 제출").unwrap();
    events.write_string(1, 1, "2026-09-15").unwrap();

    workbook.save(path).unwrap();
}

#[test]
fn inspect_workbook_reports_sheets_dimensions_and_meaningful_header() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("sample.xlsx");
    write_sample_workbook(&path, 3);

    let summary = inspect_workbook(&path).unwrap();
    assert_eq!(summary.file_name, "sample.xlsx");
    assert_eq!(summary.sheets.len(), 2);

    let projects = summary.sheets.iter().find(|sheet| sheet.name == "사업").unwrap();
    assert_eq!(projects.row_count, 4);
    assert_eq!(projects.column_count, 2);

    let preview = read_sheet_rows(&path, "사업", 50).unwrap();
    assert_eq!(preview.header_row, Some(3));
    assert_eq!(preview.rows.len(), 3);
    assert_eq!(preview.rows[0].source_row_number, 4);
    assert_eq!(preview.rows[0].values[0], "가상 사업 1");
    assert!(!preview.truncated);
}

#[test]
fn read_sheet_rows_caps_preview_at_fifty_rows_and_keeps_source_unchanged() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("large.xlsx");
    write_sample_workbook(&path, 55);
    let before = fs::read(&path).unwrap();

    let preview = read_sheet_rows(&path, "사업", 500).unwrap();

    assert_eq!(preview.rows.len(), 50);
    assert_eq!(preview.rows.first().unwrap().source_row_number, 4);
    assert_eq!(preview.rows.last().unwrap().source_row_number, 53);
    assert!(preview.truncated);
    assert_eq!(fs::read(&path).unwrap(), before);
}

#[test]
fn workbook_reader_classifies_unsupported_missing_sheet_and_corrupt_files() {
    let dir = tempdir().unwrap();

    let unsupported = dir.path().join("sample.csv");
    fs::write(&unsupported, b"a,b\n1,2\n").unwrap();
    assert_eq!(
        inspect_workbook(&unsupported).unwrap_err(),
        ExcelWorkbookError::UnsupportedFile
    );

    let valid = dir.path().join("valid.xlsx");
    write_sample_workbook(&valid, 1);
    assert_eq!(
        read_sheet_rows(&valid, "없는시트", 50).unwrap_err(),
        ExcelWorkbookError::SheetNotFound
    );

    let missing = dir.path().join("missing.xlsx");
    assert_eq!(
        inspect_workbook(&missing).unwrap_err(),
        ExcelWorkbookError::CannotOpenFile
    );

    let corrupt = dir.path().join("corrupt.xlsx");
    fs::write(&corrupt, b"not-an-xlsx-workbook").unwrap();
    assert_eq!(
        inspect_workbook(&corrupt).unwrap_err(),
        ExcelWorkbookError::WorkbookCorrupt
    );
}
