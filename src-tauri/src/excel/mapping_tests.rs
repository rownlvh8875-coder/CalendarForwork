use std::collections::BTreeMap;

use super::mapping::{suggest_mapping, validate_mapping, ImportDataset, MappingIssueCode};

#[test]
fn project_header_aliases_map_to_canonical_fields() {
    let headers = vec![
        " 공사명 ".to_string(),
        "발주기관".to_string(),
        "사업비".to_string(),
        "진행단계".to_string(),
        "담당".to_string(),
    ];

    let mapping = suggest_mapping(ImportDataset::Projects, &headers);

    assert_eq!(mapping.get("name"), Some(&0));
    assert_eq!(mapping.get("client_name"), Some(&1));
    assert_eq!(mapping.get("estimated_cost"), Some(&2));
    assert_eq!(mapping.get("current_stage"), Some(&3));
    assert_eq!(mapping.get("assignee"), Some(&4));
}

#[test]
fn event_header_aliases_map_to_canonical_fields() {
    let headers = vec![
        "일정명".to_string(),
        "일자".to_string(),
        "제출일".to_string(),
        "공사코드".to_string(),
        "카테고리".to_string(),
    ];

    let mapping = suggest_mapping(ImportDataset::Events, &headers);

    assert_eq!(mapping.get("title"), Some(&0));
    assert_eq!(mapping.get("start_at"), Some(&1));
    assert_eq!(mapping.get("deadline_at"), Some(&2));
    assert_eq!(mapping.get("project_code"), Some(&3));
    assert_eq!(mapping.get("category"), Some(&4));
}

#[test]
fn mapping_validation_rejects_missing_required_fields_and_duplicate_columns() {
    let mut missing = BTreeMap::new();
    missing.insert("client_name".to_string(), 1usize);
    let issue = validate_mapping(ImportDataset::Projects, &missing).unwrap_err();
    assert_eq!(issue.code, MappingIssueCode::MissingRequiredField);
    assert_eq!(issue.field.as_deref(), Some("name"));

    let mut duplicate = BTreeMap::new();
    duplicate.insert("name".to_string(), 0usize);
    duplicate.insert("client_name".to_string(), 0usize);
    let issue = validate_mapping(ImportDataset::Projects, &duplicate).unwrap_err();
    assert_eq!(issue.code, MappingIssueCode::DuplicateColumn);
    assert_eq!(issue.column, Some(0));

    let mut event_missing = BTreeMap::new();
    event_missing.insert("title".to_string(), 0usize);
    let issue = validate_mapping(ImportDataset::Events, &event_missing).unwrap_err();
    assert_eq!(issue.code, MappingIssueCode::MissingRequiredField);
    assert_eq!(issue.field.as_deref(), Some("start_at"));
}
