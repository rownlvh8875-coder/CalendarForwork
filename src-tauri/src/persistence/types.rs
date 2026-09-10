#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NewEventRecord {
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub client_name: Option<String>,
    pub category_id: String,
    pub category_key: String,
    pub category_name: String,
    pub title: String,
    pub description: Option<String>,
    pub start_at: String,
    pub end_at: Option<String>,
    pub deadline_at: Option<String>,
    pub all_day: bool,
    pub status: String,
    pub priority: String,
    pub assignee: Option<String>,
    pub location: Option<String>,
    pub url: Option<String>,
    pub memo: Option<String>,
    pub is_pinned: bool,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventRecord {
    pub id: String,
    #[serde(flatten)]
    pub event: NewEventRecord,
    pub created_at: String,
    pub updated_at: String,
}
