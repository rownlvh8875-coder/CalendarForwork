#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NormalizeIssueCode {
    InvalidDate,
    InvalidAmount,
    InvalidBoolean,
    InvalidStage,
    InvalidPriority,
    InvalidStatus,
    InvalidCategory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizeIssue {
    pub code: NormalizeIssueCode,
    pub value: String,
}

fn issue(code: NormalizeIssueCode, value: &str) -> NormalizeIssue {
    NormalizeIssue {
        code,
        value: value.to_string(),
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn valid_date(year: i32, month: u32, day: u32) -> bool {
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => return false,
    };
    (1..=max_day).contains(&day)
}

fn parse_date_part(value: &str) -> Option<(i32, u32, u32)> {
    let normalized = value.replace(['.', '/'], "-");
    let parts = normalized.split('-').collect::<Vec<_>>();
    if parts.len() != 3 || parts[0].len() != 4 {
        return None;
    }
    let year = parts[0].parse::<i32>().ok()?;
    let month = parts[1].parse::<u32>().ok()?;
    let day = parts[2].parse::<u32>().ok()?;
    valid_date(year, month, day).then_some((year, month, day))
}

fn parse_time_part(value: &str) -> Option<(u32, u32, u32)> {
    let parts = value.split(':').collect::<Vec<_>>();
    if !(2..=3).contains(&parts.len()) {
        return None;
    }
    let hour = parts[0].parse::<u32>().ok()?;
    let minute = parts[1].parse::<u32>().ok()?;
    let second = if parts.len() == 3 {
        parts[2].parse::<u32>().ok()?
    } else {
        0
    };
    (hour <= 23 && minute <= 59 && second <= 59).then_some((hour, minute, second))
}

pub fn normalize_date_text(value: &str) -> Result<String, NormalizeIssue> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(issue(NormalizeIssueCode::InvalidDate, value));
    }

    let (date_part, time_part) = if let Some((date, time)) = trimmed.split_once('T') {
        (date, Some(time))
    } else if let Some((date, time)) = trimmed.split_once(' ') {
        (date, Some(time))
    } else {
        (trimmed, None)
    };

    let (year, month, day) = parse_date_part(date_part)
        .ok_or_else(|| issue(NormalizeIssueCode::InvalidDate, value))?;
    let date = format!("{year:04}-{month:02}-{day:02}");

    let Some(time_part) = time_part else {
        return Ok(date);
    };
    let (hour, minute, second) = parse_time_part(time_part)
        .ok_or_else(|| issue(NormalizeIssueCode::InvalidDate, value))?;
    Ok(format!("{date}T{hour:02}:{minute:02}:{second:02}"))
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era = (day_of_era - day_of_era / 1_460 + day_of_era / 36_524
        - day_of_era / 146_096)
        / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    (year as i32, month as u32, day as u32)
}

pub fn normalize_excel_serial_date(serial: f64) -> Result<String, NormalizeIssue> {
    if !serial.is_finite() || serial < 1.0 || serial.fract().abs() > f64::EPSILON {
        return Err(issue(NormalizeIssueCode::InvalidDate, &serial.to_string()));
    }
    let serial_day = serial as i64;
    let (year, month, day) = civil_from_days(serial_day - 25_569);
    if !valid_date(year, month, day) {
        return Err(issue(NormalizeIssueCode::InvalidDate, &serial.to_string()));
    }
    Ok(format!("{year:04}-{month:02}-{day:02}"))
}

pub fn normalize_amount_number(value: f64) -> Result<i64, NormalizeIssue> {
    if !value.is_finite() || value < 0.0 {
        return Err(issue(NormalizeIssueCode::InvalidAmount, &value.to_string()));
    }
    let rounded = value.round();
    if (value - rounded).abs() > 0.000_001 || rounded > i64::MAX as f64 {
        return Err(issue(NormalizeIssueCode::InvalidAmount, &value.to_string()));
    }
    Ok(rounded as i64)
}

fn parse_scaled_decimal(value: &str, multiplier: i128) -> Option<i64> {
    let parts = value.split('.').collect::<Vec<_>>();
    if parts.len() > 2 || parts[0].is_empty() || !parts[0].chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let whole = parts[0].parse::<i128>().ok()?;
    let mut result = whole.checked_mul(multiplier)?;
    if parts.len() == 2 {
        let fraction = parts[1];
        if fraction.is_empty() || !fraction.chars().all(|c| c.is_ascii_digit()) || fraction.len() > 12 {
            return None;
        }
        let denominator = 10_i128.checked_pow(fraction.len() as u32)?;
        let numerator = fraction.parse::<i128>().ok()?.checked_mul(multiplier)?;
        if numerator % denominator != 0 {
            return None;
        }
        result = result.checked_add(numerator / denominator)?;
    }
    i64::try_from(result).ok()
}

pub fn normalize_amount_text(value: &str) -> Result<i64, NormalizeIssue> {
    let compact = value
        .trim()
        .replace(',', "")
        .replace(' ', "");
    let (numeric, multiplier) = if let Some(number) = compact.strip_suffix("억원") {
        (number, 100_000_000_i128)
    } else if let Some(number) = compact.strip_suffix("조원") {
        (number, 1_000_000_000_000_i128)
    } else if let Some(number) = compact.strip_suffix('원') {
        (number, 1_i128)
    } else {
        (compact.as_str(), 1_i128)
    };

    parse_scaled_decimal(numeric, multiplier)
        .ok_or_else(|| issue(NormalizeIssueCode::InvalidAmount, value))
}

pub fn normalize_bool(value: &str) -> Result<bool, NormalizeIssue> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "y" | "yes" | "예" | "1" => Ok(true),
        "false" | "n" | "no" | "아니오" | "0" => Ok(false),
        _ => Err(issue(NormalizeIssueCode::InvalidBoolean, value)),
    }
}

const STAGES: [(&str, &str); 17] = [
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

pub fn normalize_stage(value: &str) -> Result<&'static str, NormalizeIssue> {
    let trimmed = value.trim();
    STAGES
        .iter()
        .find(|(key, name)| key.eq_ignore_ascii_case(trimmed) || *name == trimmed)
        .map(|(key, _)| *key)
        .ok_or_else(|| issue(NormalizeIssueCode::InvalidStage, value))
}

fn normalize_alias<'a>(
    value: &str,
    aliases: &'a [(&'a str, &'a [&'a str])],
    code: NormalizeIssueCode,
) -> Result<&'a str, NormalizeIssue> {
    let trimmed = value.trim();
    for (key, names) in aliases {
        if key.eq_ignore_ascii_case(trimmed)
            || names.iter().any(|name| name.eq_ignore_ascii_case(trimmed))
        {
            return Ok(*key);
        }
    }
    Err(issue(code, value))
}

pub fn normalize_priority(value: &str) -> Result<&'static str, NormalizeIssue> {
    normalize_alias(
        value,
        &[
            ("low", &["낮음"]),
            ("normal", &["보통", "일반"]),
            ("high", &["높음", "중요"]),
            ("critical", &["긴급", "최우선"]),
        ],
        NormalizeIssueCode::InvalidPriority,
    )
}

pub fn normalize_status(value: &str) -> Result<&'static str, NormalizeIssue> {
    normalize_alias(
        value,
        &[
            ("planned", &["예정", "계획"]),
            ("in-progress", &["진행중", "진행"]),
            ("completed", &["완료"]),
            ("cancelled", &["취소"]),
        ],
        NormalizeIssueCode::InvalidStatus,
    )
}

pub fn normalize_category(value: &str) -> Result<&'static str, NormalizeIssue> {
    normalize_alias(
        value,
        &[
            ("notice", &["입찰공고"]),
            ("pq", &["PQ"]),
            ("soq", &["SOQ"]),
            ("site-briefing", &["현장설명", "현설"]),
            ("design", &["설계"]),
            ("design-review", &["설계심의"]),
            ("price-bid", &["가격입찰", "가격"]),
            ("opening", &["개찰"]),
            ("planned-order", &["발주예정"]),
            ("meeting", &["회의"]),
            ("report", &["보고"]),
            ("submission", &["제출"]),
            ("other", &["기타"]),
        ],
        NormalizeIssueCode::InvalidCategory,
    )
}
