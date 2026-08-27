CREATE TABLE job_statuses (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX job_statuses_org_idx ON job_statuses (org_id);

ALTER TABLE customers ADD COLUMN phones TEXT NOT NULL DEFAULT '[]';
ALTER TABLE customers ADD COLUMN emails TEXT NOT NULL DEFAULT '[]';
ALTER TABLE customers ADD COLUMN addresses TEXT NOT NULL DEFAULT '[]';

UPDATE customers SET phones = CASE WHEN phone = '' THEN '[]' ELSE json_array(phone) END;
UPDATE customers SET emails = CASE WHEN email = '' THEN '[]' ELSE json_array(email) END;
UPDATE customers SET addresses = CASE WHEN address = '' THEN '[]' ELSE json_array(address) END;

UPDATE jobs SET status = '下書き' WHERE status = 'draft';
UPDATE jobs SET status = '割当日' WHERE status = 'assigned';
UPDATE jobs SET status = '完了' WHERE status = 'done';
UPDATE jobs SET status = 'キャンセル' WHERE status = 'cancelled';
