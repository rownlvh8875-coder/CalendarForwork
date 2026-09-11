use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStageHistoryRecord {
    pub id: String,
    pub project_id: String,
    pub from_stage: Option<String>,
    pub to_stage: String,
    pub changed_at: String,
    pub source: String,
    pub note: Option<String>,
    pub created_at: String,
}
