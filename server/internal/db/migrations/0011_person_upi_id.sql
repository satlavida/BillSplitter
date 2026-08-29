-- Per-person UPI ID: lets others know where to pay a person back. Optional,
-- empty string means unset — matches the frontend's Person.upiId default
-- (bill.schema.ts / live.schema.ts), never null.
ALTER TABLE people ADD COLUMN upi_id TEXT NOT NULL DEFAULT '';
