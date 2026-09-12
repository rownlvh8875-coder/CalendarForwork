use std::{fs::File, path::Path};

use calamine::{open_workbook_auto, Data, Reader};
use thiserror::Error;

use super::types::{SheetPreview, SheetRow, SheetSummary, WorkbookSummary};

const PREVIEW_ROW_LIMIT: usize = 50;
const SUPPORTED_EXTENSIONS: [&str; 5] = ["xlsx", "xls", "xlsm", "xlsb", "ods"];

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ExcelWorkbookError {
    #[error("unsupported Excel file")]
    UnsupportedFile,
    #[error("cannot open Excel file")]
    CannotOpenFile,
    #[error("workbook is corrupt or unreadable")]
    WorkbookCorrupt,
    #[error("worksheet was not found")]
    SheetNotFound,
}

fn validate_source(path: &Path) -> Result<(), ExcelWorkbookError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or(ExcelWorkbookError::UnsupportedFile)?;

    if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(ExcelWorkbookError::UnsupportedFile);
    }

    File::open(path).map_err(|_| ExcelWorkbookError::CannotOpenFile)?;
    Ok(())
}

fn cell_display(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        _ => cell.to_string().trim().to_string(),
    }
}

fn row_has_value(row: &[Data]) -> bool {
    row.iter().any(|cell| !cell_display(cell).is_empty())
}

pub fn inspect_workbook(path: &Path) -> Result<WorkbookSummary, ExcelWorkbookError> {
    validate_source(path)?;
    let mut workbook = open_workbook_auto(path).map_err(|_| ExcelWorkbookError::WorkbookCorrupt)?;
    let sheet_names = workbook.sheet_names();
    let mut sheets = Vec::with_capacity(sheet_names.len());

    for name in sheet_names {
        let range = workbook
            .worksheet_range(&name)
            .map_err(|_| ExcelWorkbookError::WorkbookCorrupt)?;
        let (row_count, column_count) = range.get_size();
        sheets.push(SheetSummary {
            name,
            row_count,
            column_count,
        });
    }

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();

    Ok(WorkbookSummary { file_name, sheets })
}

pub fn read_sheet_rows(
    path: &Path,
    sheet_name: &str,
    requested_limit: usize,
) -> Result<SheetPreview, ExcelWorkbookError> {
    validate_source(path)?;
    let mut workbook = open_workbook_auto(path).map_err(|_| ExcelWorkbookError::WorkbookCorrupt)?;
    if !workbook.sheet_names().iter().any(|name| name == sheet_name) {
        return Err(ExcelWorkbookError::SheetNotFound);
    }

    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| ExcelWorkbookError::WorkbookCorrupt)?;
    let start_row = range.start().map(|(row, _)| row as usize).unwrap_or(0);
    let rows = range.rows().collect::<Vec<_>>();
    let Some(header_relative_index) = rows.iter().position(|row| row_has_value(row)) else {
        return Ok(SheetPreview {
            header_row: None,
            rows: Vec::new(),
            truncated: false,
        });
    };

    let data_rows = &rows[(header_relative_index + 1)..];
    let limit = requested_limit.min(PREVIEW_ROW_LIMIT);
    let preview_rows = data_rows
        .iter()
        .take(limit)
        .enumerate()
        .map(|(index, row)| SheetRow {
            source_row_number: start_row + header_relative_index + index + 2,
            values: row.iter().map(cell_display).collect(),
        })
        .collect();

    Ok(SheetPreview {
        header_row: Some(start_row + header_relative_index + 1),
        rows: preview_rows,
        truncated: data_rows.len() > limit,
    })
}
