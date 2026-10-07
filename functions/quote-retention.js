const DAY = 86400000;

export function customerPersonalExpiresAt(row) {
  const createdAt = Date.parse(row?.created_at || "");
  return Number.isFinite(createdAt) ? new Date(createdAt + 30 * DAY).toISOString() : "";
}

function selectionTime(row) {
  // Legacy selections keep their original deadline; never invent a new selection date.
  return Date.parse(row?.selected_at || (row?.selected_bid_id ? row.created_at : ""));
}

export function customerPhoneRetentionExpiresAt(row) {
  const personalDeadline = Date.parse(customerPersonalExpiresAt(row));
  if (!Number.isFinite(personalDeadline)) return "";
  if (!row.selected_at && !row.selected_bid_id) return new Date(personalDeadline).toISOString();
  const selectedAt = selectionTime(row);
  if (!Number.isFinite(selectedAt)) return "";
  return new Date(Math.min(selectedAt + 7 * DAY, personalDeadline)).toISOString();
}

export function customerPhoneRetained(row, now = Date.now()) {
  const createdAt = Date.parse(row?.created_at || "");
  const deadline = Date.parse(customerPhoneRetentionExpiresAt(row));
  return Number.isFinite(createdAt) && createdAt <= now && now < deadline;
}

export function customerPhoneAccessExpiresAt(row) {
  return row?.selected_bid_id ? customerPhoneRetentionExpiresAt(row) : "";
}

export function customerPhoneWithinSevenDays(row, now = Date.now()) {
  return Boolean(row?.selected_bid_id) && selectionTime(row) <= now && customerPhoneRetained(row, now);
}
