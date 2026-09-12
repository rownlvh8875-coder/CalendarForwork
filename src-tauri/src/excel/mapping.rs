use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportDataset {
    Projects,
    Events,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MappingIssueCode {
    MissingRequiredField,
    DuplicateColumn,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MappingIssue {
    pub code: MappingIssueCode,
    pub field: Option<String>,
    pub column: Option<usize>,
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|character| character.is_alphanumeric())
        .flat_map(|character| character.to_lowercase())
        .collect()
}

fn field_for_alias(dataset: ImportDataset, header: &str) -> Option<&'static str> {
    let normalized = normalize_header(header);
    let field = match dataset {
        ImportDataset::Projects => match normalized.as_str() {
            "사업명" | "공사명" | "프로젝트명" => "name",
            "사업코드" | "공사코드" | "프로젝트코드" => "project_code",
            "발주처" | "발주기관" | "기관명" => "client_name",
            "공사유형" | "사업유형" => "project_type",
            "지역" | "권역" => "region",
            "계약방식" | "입찰방식" => "contract_type",
            "공사비" | "사업비" | "예정금액" | "추정공사비" => "estimated_cost",
            "진행상황" | "진행단계" | "현재단계" | "단계" => "current_stage",
            "중요도" | "우선순위" => "priority",
            "담당자" | "담당" => "assignee",
            "발주예정일" | "입찰예정일" | "예정일" => "expected_bid_date",
            "사업개요" | "개요" | "설명" => "description",
            "메모" | "비고" => "memo",
            "url" | "링크" => "url",
            _ => return None,
        },
        ImportDataset::Events => match normalized.as_str() {
            "일정명" | "업무명" | "일정" | "제목" => "title",
            "일자" | "날짜" | "시작일" | "일정일" => "start_at",
            "종료일" | "종료일시" => "end_at",
            "마감일" | "제출일" | "deadline" => "deadline_at",
            "사업명" | "공사명" => "project_name",
            "사업코드" | "공사코드" => "project_code",
            "발주처" | "발주기관" => "client_name",
            "일정분류" | "카테고리" | "구분" => "category",
            "설명" | "내용" => "description",
            "종일" | "종일여부" => "all_day",
            "상태" | "진행상태" => "status",
            "중요도" | "우선순위" => "priority",
            "담당자" | "담당" => "assignee",
            "위치" | "장소" => "location",
            "url" | "링크" => "url",
            "메모" | "비고" => "memo",
            "중요일정" | "고정" => "is_pinned",
            _ => return None,
        },
    };
    Some(field)
}

pub fn suggest_mapping(dataset: ImportDataset, headers: &[String]) -> BTreeMap<String, usize> {
    let mut mapping = BTreeMap::new();
    for (column, header) in headers.iter().enumerate() {
        if let Some(field) = field_for_alias(dataset, header) {
            mapping.entry(field.to_string()).or_insert(column);
        }
    }
    mapping
}

pub fn validate_mapping(
    dataset: ImportDataset,
    mapping: &BTreeMap<String, usize>,
) -> Result<(), MappingIssue> {
    let required: &[&str] = match dataset {
        ImportDataset::Projects => &["name"],
        ImportDataset::Events => &["title", "start_at"],
    };

    for required_field in required {
        if !mapping.contains_key(*required_field) {
            return Err(MappingIssue {
                code: MappingIssueCode::MissingRequiredField,
                field: Some((*required_field).to_string()),
                column: None,
            });
        }
    }

    let mut seen = BTreeSet::new();
    for column in mapping.values().copied() {
        if !seen.insert(column) {
            return Err(MappingIssue {
                code: MappingIssueCode::DuplicateColumn,
                field: None,
                column: Some(column),
            });
        }
    }

    Ok(())
}
