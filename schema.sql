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
  approved_at TEXT NOT NULL
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

