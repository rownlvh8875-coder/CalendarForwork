use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewClientRecord {
    pub name: String,
    pub category: Option<String>,
    pub department: Option<String>,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientRecord {
    pub id: String,
    #[serde(flatten)]
    pub client: NewClientRecord,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProjectRecord {
    pub project_code: Option<String>,
    pub name: String,
    pub client_id: Option<String>,
    pub project_type: Option<String>,
    pub region: Option<String>,
    pub contract_type: Option<String>,
    pub estimated_cost: Option<i64>,
    pub current_stage: String,
    pub priority: String,
    pub assignee: Option<String>,
    pub expected_bid_date: Option<String>,
    pub description: Option<String>,
    pub memo: Option<String>,
    pub url: Option<String>,
    pub archived: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    #[serde(flatten)]
    pub project: NewProjectRecord,
    pub client_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStageRecord {
    pub key: String,
    pub name: String,
    pub sort_order: i64,
    pub is_active: bool,
}
