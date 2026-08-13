CREATE TABLE IF NOT EXISTS seller_applications (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  reviewed_at TEXT DEFAULT '',
  review_memo TEXT DEFAULT '',
  seller_id TEXT NOT NULL,
  password TEXT NOT NULL,
  channel TEXT NOT NULL,
  branch TEXT NOT NULL,
  branch_region TEXT NOT NULL,
  manager TEXT NOT NULL,
  manager_position TEXT DEFAULT '',
  phone TEXT NOT NULL,
  card_image TEXT DEFAULT '',
  card_image_key TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  consent_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_seller_id ON seller_applications(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_applications_phone ON seller_applications(phone);

CREATE TABLE IF NOT EXISTS approved_sellers (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'approved',
  seller_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  channel TEXT NOT NULL,
  branch TEXT NOT NULL,
  branch_region TEXT NOT NULL,
  manager TEXT NOT NULL,
  manager_position TEXT DEFAULT '',
  phone TEXT NOT NULL,
  card_image TEXT DEFAULT '',
  card_image_key TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  consent_json TEXT DEFAULT '{}',
  requested_at TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  review_memo TEXT DEFAULT '',
  approved_at TEXT NOT NULL,
  quote_alimtalk_opt_out INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_approved_sellers_seller_id ON approved_sellers(seller_id);
CREATE INDEX IF NOT EXISTS idx_approved_sellers_phone ON approved_sellers(phone);

CREATE TABLE IF NOT EXISTS alimtalk_queue (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ready',
  type TEXT NOT NULL,
  target_role TEXT DEFAULT '',
  target_name TEXT DEFAULT '',
  target_phone TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_id TEXT DEFAULT '',
  template_id TEXT DEFAULT '',
  variables_json TEXT DEFAULT '{}',
  solapi_group_id TEXT DEFAULT '',
  solapi_message_id TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  solapi_response_json TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  sent_at TEXT DEFAULT '',
  canceled_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_status ON alimtalk_queue(status);
CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_related_id ON alimtalk_queue(related_id);

CREATE TABLE IF NOT EXISTS customer_quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  items TEXT NOT NULL,
  quote_type TEXT DEFAULT '',
  purchase_purpose TEXT DEFAULT '',
  desired_brand TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  region TEXT DEFAULT '',
  install_date TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  selected_bid_id TEXT DEFAULT '',
  contact_release_scope TEXT DEFAULT 'selected',
  contact_released_bid_ids TEXT DEFAULT '[]',
  submission_count INTEGER DEFAULT 1,
  previous_lowest_price INTEGER DEFAULT 0,
  rank_notice_queued_at TEXT DEFAULT '',
  sale_completed_at TEXT DEFAULT '',
  thumbnail_image TEXT DEFAULT '',
  thumbnail_image_key TEXT DEFAULT '',
  quote_expires_at TEXT DEFAULT '',
  full_images_expires_at TEXT DEFAULT '',
  personal_expires_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  consent_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_customer_quotes_quote_number ON customer_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_customer_quotes_phone ON customer_quotes(phone);

CREATE TABLE IF NOT EXISTS quote_images (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  url TEXT NOT NULL,
  image_type TEXT DEFAULT 'full',
  sort_order INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES customer_quotes(id)
);

CREATE INDEX IF NOT EXISTS idx_quote_images_quote_id ON quote_images(quote_id);

CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller TEXT NOT NULL,
  channel TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  manager_position TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  card_image TEXT DEFAULT '',
  price INTEGER NOT NULL,
  benefits TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT DEFAULT '',
  FOREIGN KEY (quote_id) REFERENCES customer_quotes(id)
);

CREATE INDEX IF NOT EXISTS idx_bids_quote_id ON bids(quote_id);
CREATE INDEX IF NOT EXISTS idx_bids_seller_id ON bids(seller_id);
CREATE INDEX IF NOT EXISTS idx_bids_price ON bids(price);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  bid_id TEXT NOT NULL,
  seller_id TEXT DEFAULT '',
  seller TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  rating INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES customer_quotes(id),
  FOREIGN KEY (bid_id) REFERENCES bids(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id);

CREATE TABLE IF NOT EXISTS guide_dismissals (
  id TEXT PRIMARY KEY,
  guide_type TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  dismiss_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guide_dismissals_lookup ON guide_dismissals(guide_type, ip_hash, dismiss_date);

CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'android',
  app TEXT NOT NULL DEFAULT 'public',
  role TEXT NOT NULL DEFAULT 'public',
  device_id TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  last_url TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_role ON push_tokens(role);
CREATE INDEX IF NOT EXISTS idx_push_tokens_updated_at ON push_tokens(updated_at);

CREATE TABLE IF NOT EXISTS lplan_quote_patterns (
  id TEXT PRIMARY KEY,
  source_quote_id TEXT DEFAULT '',
  title TEXT DEFAULT '',
  source_saved_at TEXT DEFAULT '',
  synced_at TEXT NOT NULL,
  branch TEXT DEFAULT '',
  manager_hash TEXT DEFAULT '',
  membership_type TEXT DEFAULT '',
  quote_date TEXT DEFAULT '',
  delivery_date TEXT DEFAULT '',
  item_count INTEGER DEFAULT 0,
  total_reg_price INTEGER DEFAULT 0,
  total_point INTEGER DEFAULT 0,
  total_cashback INTEGER DEFAULT 0,
  combo_key TEXT DEFAULT '',
  rows_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lplan_quote_patterns_synced_at ON lplan_quote_patterns(synced_at);
CREATE INDEX IF NOT EXISTS idx_lplan_quote_patterns_combo_key ON lplan_quote_patterns(combo_key);

CREATE TABLE IF NOT EXISTS site_visit_daily (
  visit_date TEXT PRIMARY KEY,
  page_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_visit_uniques (
  visit_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (visit_date, visitor_hash)
);

CREATE TABLE IF NOT EXISTS site_visit_events (
  event_key TEXT PRIMARY KEY,
  visit_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_visit_events_date ON site_visit_events(visit_date);



CREATE TABLE IF NOT EXISTS seller_access_logs (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'login',
  access_date TEXT NOT NULL,
  accessed_at TEXT NOT NULL,
  ip_masked TEXT DEFAULT '',
  ip_hash TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  device_type TEXT DEFAULT '',
  browser_name TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seller_access_logs_seller_time ON seller_access_logs(seller_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_access_logs_date ON seller_access_logs(access_date, accessed_at DESC);

-- 브랜드관: 승인 판매자 다품목 패키지
CREATE TABLE IF NOT EXISTS anonymous_consultations (
  id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL, seller_id TEXT NOT NULL,
  started_by TEXT NOT NULL DEFAULT 'customer', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, selected_at TEXT DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_consultation_bid ON anonymous_consultations(quote_id, bid_id);
CREATE TABLE IF NOT EXISTS anonymous_consultation_messages (
  id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, sender_role TEXT NOT NULL, sender_id TEXT DEFAULT '',
  body TEXT NOT NULL, normalized_body TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anon_messages_consultation ON anonymous_consultation_messages(consultation_id, created_at);
CREATE TABLE IF NOT EXISTS anonymous_policy_cases (
  id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, message_id TEXT NOT NULL, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL,
  seller_id TEXT NOT NULL, branch TEXT DEFAULT '', detection_type TEXT NOT NULL, original_message TEXT NOT NULL,
  normalized_message TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'UNDER_REVIEW', follow_up_action TEXT DEFAULT '',
  prior_violation_count INTEGER DEFAULT 0, region_violation_count INTEGER DEFAULT 0, reviewed_at TEXT DEFAULT '', reviewed_by TEXT DEFAULT '', review_memo TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anon_cases_status ON anonymous_policy_cases(status, created_at DESC);
CREATE TABLE IF NOT EXISTS anonymous_seller_restrictions (
  seller_id TEXT PRIMARY KEY, branch_key TEXT NOT NULL, seller_status TEXT NOT NULL DEFAULT 'ACTIVE', region_status TEXT NOT NULL DEFAULT 'NORMAL',
  violation_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, last_case_id TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS anonymous_audit_logs (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, case_id TEXT DEFAULT '', consultation_id TEXT DEFAULT '', seller_id TEXT DEFAULT '', payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anon_audit_created ON anonymous_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS brand_packages (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  channel TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  branch_region TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  manager_phone TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  title TEXT NOT NULL,
  items_json TEXT DEFAULT '[]',
  original_price INTEGER DEFAULT 0,
  sale_price INTEGER DEFAULT 0,
  benefits TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  cover_image_key TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brand_packages_status_updated ON brand_packages(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_packages_seller ON brand_packages(seller_id, updated_at DESC);

-- 브랜드관: 고객 상담 신청
CREATE TABLE IF NOT EXISTS brand_consultations (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  channel TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  manager_phone TEXT DEFAULT '',
  package_title TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_region TEXT DEFAULT '',
  preferred_time TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  consent_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'new',
  delivery_status TEXT DEFAULT 'pending',
  delivery_error TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brand_consultations_seller ON brand_consultations(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_consultations_package ON brand_consultations(package_id, created_at DESC);
