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
  scheduled_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  sent_at TEXT DEFAULT '',
  canceled_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_status ON alimtalk_queue(status);
CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_related_id ON alimtalk_queue(related_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_scheduled ON alimtalk_queue(status, scheduled_at);

CREATE TABLE IF NOT EXISTS customer_quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  items TEXT NOT NULL,
  purchase_purpose TEXT DEFAULT '',
  desired_brand TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  region TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  selected_bid_id TEXT DEFAULT '',
  sale_completed_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  consent_json TEXT DEFAULT '{}',
  submission_ip_masked TEXT DEFAULT '',
  submission_ip_hash TEXT DEFAULT '',
  submission_ip_encrypted TEXT DEFAULT '',
  submission_country TEXT DEFAULT '',
  submission_region TEXT DEFAULT '',
  submission_city TEXT DEFAULT '',
  submission_user_agent TEXT DEFAULT '',
  submission_device_type TEXT DEFAULT '',
  submission_browser_name TEXT DEFAULT '',
  submission_cf_ray TEXT DEFAULT '',
  submission_consent_version TEXT DEFAULT '',
  submission_consented_at TEXT DEFAULT '',
  submission_recorded_at TEXT DEFAULT '',
  submission_phone_verified INTEGER NOT NULL DEFAULT 0,
  submission_phone_verification_id TEXT DEFAULT '',
  submission_phone_verified_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_customer_quotes_quote_number ON customer_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_customer_quotes_phone ON customer_quotes(phone);

CREATE TABLE IF NOT EXISTS quote_phone_verifications (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  token_hash TEXT DEFAULT '',
  request_ip_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  token_expires_at TEXT DEFAULT '',
  requested_at TEXT NOT NULL,
  verified_at TEXT DEFAULT '',
  consumed_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_quote_phone_verifications_phone_time
  ON quote_phone_verifications(phone_hash, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_phone_verifications_ip_time
  ON quote_phone_verifications(request_ip_hash, requested_at DESC);

CREATE TABLE IF NOT EXISTS quote_images (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS subscription_consultations (
  id TEXT PRIMARY KEY,
  product_model TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  option_model TEXT DEFAULT '',
  option_label TEXT DEFAULT '',
  monthly_fee_72 INTEGER DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_region TEXT DEFAULT '',
  preferred_time TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  partner_name TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  collection_consent_json TEXT NOT NULL DEFAULT '{}',
  third_party_consent_json TEXT NOT NULL DEFAULT '{}',
  consented_at TEXT NOT NULL,
  phone_verification_id TEXT NOT NULL,
  phone_verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_error TEXT DEFAULT '',
  contract_amount INTEGER DEFAULT 0,
  commission_amount INTEGER DEFAULT 0,
  settlement_status TEXT DEFAULT 'unsettled',
  admin_memo TEXT DEFAULT '',
  settled_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_consultations_created
  ON subscription_consultations(created_at DESC);
