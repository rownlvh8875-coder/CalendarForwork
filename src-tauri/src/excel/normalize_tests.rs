use super::normalize::{
    normalize_amount_number, normalize_amount_text, normalize_bool, normalize_category,
    normalize_date_text, normalize_excel_serial_date, normalize_priority, normalize_stage,
    normalize_status, NormalizeIssueCode,
};

#[test]
fn normalizes_excel_and_common_text_dates_and_rejects_ambiguous_dates() {
    assert_eq!(normalize_excel_serial_date(46280.0).unwrap(), "2026-09-15");
    assert_eq!(normalize_date_text("2026-09-15").unwrap(), "2026-09-15");
    assert_eq!(normalize_date_text("2026.09.15").unwrap(), "2026-09-15");
    assert_eq!(normalize_date_text("2026/09/15").unwrap(), "2026-09-15");
    assert_eq!(
        normalize_date_text("2026-09-15 13:30").unwrap(),
        "2026-09-15T13:30:00"
    );
    assert_eq!(
        normalize_date_text("2026-09-15T13:30:45").unwrap(),
        "2026-09-15T13:30:45"
    );

    let issue = normalize_date_text("03/04/26").unwrap_err();
    assert_eq!(issue.code, NormalizeIssueCode::InvalidDate);
    assert!(normalize_date_text("2026-02-30").is_err());
}

#[test]
fn normalizes_won_eok_and_trillion_amounts_without_float_rounding_surprises() {
    assert_eq!(normalize_amount_number(320_000_000_000.0).unwrap(), 320_000_000_000);
    assert_eq!(normalize_amount_text("320000000000").unwrap(), 320_000_000_000);
    assert_eq!(normalize_amount_text("320,000,000,000").unwrap(), 320_000_000_000);
    assert_eq!(normalize_amount_text("3,200억원").unwrap(), 320_000_000_000);
    assert_eq!(normalize_amount_text("3.2조원").unwrap(), 3_200_000_000_000);

    let issue = normalize_amount_text("약 삼천억원").unwrap_err();
    assert_eq!(issue.code, NormalizeIssueCode::InvalidAmount);
}

#[test]
fn normalizes_boolean_priority_status_and_category_aliases() {
    for (source, expected) in [
        ("true", true),
        ("Y", true),
        ("예", true),
        ("1", true),
        ("false", false),
        ("N", false),
        ("아니오", false),
        ("0", false),
    ] {
        assert_eq!(normalize_bool(source).unwrap(), expected, "{source}");
    }

    assert_eq!(normalize_priority("긴급").unwrap(), "critical");
    assert_eq!(normalize_priority("높음").unwrap(), "high");
    assert_eq!(normalize_priority("보통").unwrap(), "normal");
    assert_eq!(normalize_priority("낮음").unwrap(), "low");

    assert_eq!(normalize_status("예정").unwrap(), "planned");
    assert_eq!(normalize_status("진행중").unwrap(), "in-progress");
    assert_eq!(normalize_status("완료").unwrap(), "completed");
    assert_eq!(normalize_status("취소").unwrap(), "cancelled");

    assert_eq!(normalize_category("입찰공고").unwrap(), "notice");
    assert_eq!(normalize_category("현장설명").unwrap(), "site-briefing");
    assert_eq!(normalize_category("설계심의").unwrap(), "design-review");
    assert_eq!(normalize_category("가격입찰").unwrap(), "price-bid");
    assert_eq!(normalize_category("기타").unwrap(), "other");
}

#[test]
fn accepts_all_seventeen_project_stage_keys_and_korean_names() {
    let stages = [
        ("interest", "관심사업"),
        ("planning", "계획"),
        ("planned-order", "발주예정"),
        ("notice", "입찰공고"),
        ("pq", "PQ"),
        ("soq", "SOQ"),
        ("basic-design", "기본설계"),
        ("detailed-design", "실시설계"),
        ("design-review", "설계심의"),
        ("price-bid", "가격입찰"),
        ("opening", "개찰"),
        ("preferred-bidder", "우선협상"),
        ("won", "수주"),
        ("lost", "탈락"),
        ("hold", "보류"),
        ("closed", "종료"),
        ("cancelled", "취소"),
    ];

    for (key, name) in stages {
        assert_eq!(normalize_stage(key).unwrap(), key);
        assert_eq!(normalize_stage(name).unwrap(), key);
    }

    let issue = normalize_stage("임의단계").unwrap_err();
    assert_eq!(issue.code, NormalizeIssueCode::InvalidStage);
}
