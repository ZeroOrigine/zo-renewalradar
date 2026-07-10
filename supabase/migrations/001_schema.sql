-- ============================================================================
-- RenewalRadar — Production Schema (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- KERNEL: a "renewal" — anything that auto-renews on a date (SaaS tools,
-- domains, insurance, contracts) — plus the alert machinery that warns the
-- owner BEFORE the charge hits or the cancellation window closes.
--
-- SHARED-DATABASE ISOLATION: every table, enum, function, trigger, and index
-- is prefixed `renewalradar_`. No generic names anywhere.
--
-- v1 = exactly 5 tables (Dorsey constraint):
--   renewalradar_profiles       — extends auth.users
--   renewalradar_renewals       — THE KERNEL (alert state embedded here;
--                                 a separate reminder-log table was deleted
--                                 per Musk delete-first — next_alert_at /
--                                 last_alert_at on the row is enough for v1)
--   renewalradar_plans          — billing plan lookup (seeded)
--   renewalradar_subscriptions  — Stripe subscription state (service-role writes)
--   renewalradar_payments       — one-time Stripe charges (service-role writes)
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 2. ENUMS (prefixed — enum type names share the schema namespace too)
-- ============================================================================
CREATE TYPE renewalradar_user_role AS ENUM ('user', 'admin');

CREATE TYPE renewalradar_renewal_status AS ENUM ('active', 'paused', 'canceled', 'expired');

CREATE TYPE renewalradar_billing_cycle AS ENUM (
  'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'biennial', 'custom'
);

CREATE TYPE renewalradar_renewal_category AS ENUM (
  'software', 'infrastructure', 'domain', 'insurance',
  'marketing', 'finance', 'office', 'other'
);

-- Mirrors Stripe subscription statuses; free-tier rows use 'active'.
CREATE TYPE renewalradar_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

CREATE TYPE renewalradar_payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- 3.1 Profiles — extends auth.users -----------------------------------------
CREATE TABLE renewalradar_profiles (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY
                         REFERENCES auth.users (id) ON DELETE CASCADE,
  email                text,                                   -- denormalized from auth.users; nullable (OAuth/phone signups)
  full_name            text,
  avatar_url           text,
  role                 renewalradar_user_role NOT NULL DEFAULT 'user',
  default_currency     text NOT NULL DEFAULT 'USD' CHECK (char_length(default_currency) = 3),
  timezone             text NOT NULL DEFAULT 'UTC',
  default_alert_days   integer[] NOT NULL DEFAULT ARRAY[30, 7, 1], -- smart default: copied onto new renewals by the app
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 3.2 Renewals — THE KERNEL ---------------------------------------------------
CREATE TABLE renewalradar_renewals (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES renewalradar_profiles (id) ON DELETE CASCADE,
  vendor_name         text NOT NULL CHECK (char_length(vendor_name) BETWEEN 1 AND 200),
  vendor_url          text,
  category            renewalradar_renewal_category NOT NULL DEFAULT 'software',
  amount              numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),  -- per billing cycle, user-facing units
  currency            text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  billing_cycle       renewalradar_billing_cycle NOT NULL DEFAULT 'annual',
  next_renewal_date   date NOT NULL,
  auto_renews         boolean NOT NULL DEFAULT true,
  cancel_notice_days  integer NOT NULL DEFAULT 0 CHECK (cancel_notice_days >= 0), -- vendor's required cancellation notice
  status              renewalradar_renewal_status NOT NULL DEFAULT 'active',
  alert_days_before   integer[] NOT NULL DEFAULT ARRAY[30, 7, 1],
  next_alert_at       timestamptz,   -- maintained by trigger; the cron sweeps this
  last_alert_at       timestamptz,   -- set by the alert cron after each send
  notes               text,
  -- Last safe day to cancel — the product's killer insight, computed in the DB:
  cancel_by_date      date GENERATED ALWAYS AS (next_renewal_date - cancel_notice_days) STORED,
  -- Normalized monthly cost so dashboard totals are a single SUM():
  monthly_amount      numeric(12,2) GENERATED ALWAYS AS (
                        CASE billing_cycle
                          WHEN 'weekly'      THEN round(amount * 52 / 12, 2)
                          WHEN 'monthly'     THEN amount
                          WHEN 'quarterly'   THEN round(amount / 3, 2)
                          WHEN 'semi_annual' THEN round(amount / 6, 2)
                          WHEN 'annual'      THEN round(amount / 12, 2)
                          WHEN 'biennial'    THEN round(amount / 24, 2)
                          ELSE NULL
                        END
                      ) STORED,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 3.3 Plans — billing lookup (seeded below) ----------------------------------
CREATE TABLE renewalradar_plans (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  description             text,
  price_monthly_cents     integer NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  price_yearly_cents      integer NOT NULL DEFAULT 0 CHECK (price_yearly_cents >= 0),
  stripe_price_id_monthly text,          -- populated by Deploy Mind after Stripe product creation
  stripe_price_id_yearly  text,          -- populated by Deploy Mind after Stripe product creation
  max_renewals            integer,       -- NULL = unlimited
  features                jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active               boolean NOT NULL DEFAULT true,
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 3.4 Subscriptions — Stripe subscription state (one row per user) -----------
CREATE TABLE renewalradar_subscriptions (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                uuid NOT NULL UNIQUE REFERENCES renewalradar_profiles (id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan                   text NOT NULL DEFAULT 'free'
                           REFERENCES renewalradar_plans (slug)
                           ON UPDATE CASCADE ON DELETE RESTRICT,
  status                 renewalradar_subscription_status NOT NULL DEFAULT 'active',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- 3.5 Payments — one-time Stripe charges (receipts / billing history) --------
CREATE TABLE renewalradar_payments (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                    uuid NOT NULL REFERENCES renewalradar_profiles (id) ON DELETE CASCADE,
  stripe_payment_intent_id   text UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  amount_cents               integer NOT NULL CHECK (amount_cents >= 0),
  currency                   text NOT NULL DEFAULT 'usd' CHECK (char_length(currency) = 3), -- lowercase per Stripe
  description                text,
  status                     renewalradar_payment_status NOT NULL DEFAULT 'pending',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================================

-- 4.1 Generic updated_at maintainer ------------------------------------------
CREATE OR REPLACE FUNCTION renewalradar_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER renewalradar_profiles_set_updated_at
  BEFORE UPDATE ON renewalradar_profiles
  FOR EACH ROW EXECUTE FUNCTION renewalradar_update_updated_at();

CREATE TRIGGER renewalradar_renewals_set_updated_at
  BEFORE UPDATE ON renewalradar_renewals
  FOR EACH ROW EXECUTE FUNCTION renewalradar_update_updated_at();

CREATE TRIGGER renewalradar_plans_set_updated_at
  BEFORE UPDATE ON renewalradar_plans
  FOR EACH ROW EXECUTE FUNCTION renewalradar_update_updated_at();

CREATE TRIGGER renewalradar_subscriptions_set_updated_at
  BEFORE UPDATE ON renewalradar_subscriptions
  FOR EACH ROW EXECUTE FUNCTION renewalradar_update_updated_at();

CREATE TRIGGER renewalradar_payments_set_updated_at
  BEFORE UPDATE ON renewalradar_payments
  FOR EACH ROW EXECUTE FUNCTION renewalradar_update_updated_at();

-- 4.2 Admin check (SECURITY DEFINER avoids RLS recursion on profiles) --------
CREATE OR REPLACE FUNCTION renewalradar_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.renewalradar_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

-- 4.3 Alert scheduling: pick the next alert timestamp for a renewal ----------
-- Returns the earliest (renewal_date - N days) that is today-or-later AND
-- strictly after p_after (prevents the cron from double-sending same window).
CREATE OR REPLACE FUNCTION renewalradar_compute_next_alert(
  p_renewal_date date,
  p_alert_days   integer[],
  p_after        timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT min(a.alert_at)
  FROM (
    SELECT (p_renewal_date - d)::timestamptz AS alert_at
    FROM unnest(COALESCE(p_alert_days, ARRAY[30, 7, 1])) AS d
  ) a
  WHERE a.alert_at >= date_trunc('day', now())
    AND (p_after IS NULL OR a.alert_at > p_after);
$$;

-- 4.4 Keep next_alert_at correct on every write ------------------------------
CREATE OR REPLACE FUNCTION renewalradar_set_next_alert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    NEW.next_alert_at := renewalradar_compute_next_alert(
      NEW.next_renewal_date, NEW.alert_days_before, NEW.last_alert_at
    );
  ELSE
    NEW.next_alert_at := NULL;  -- paused/canceled/expired items never alert
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER renewalradar_renewals_compute_alert
  BEFORE INSERT OR UPDATE ON renewalradar_renewals
  FOR EACH ROW EXECUTE FUNCTION renewalradar_set_next_alert();

-- 4.5 Daily cron helper: expire lapsed items, roll auto-renewals forward -----
-- Called by the scheduled edge function (service role). Returns rows rolled.
CREATE OR REPLACE FUNCTION renewalradar_roll_overdue_renewals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rolled integer := 0;
BEGIN
  -- Non-auto-renewing items whose date passed are done.
  UPDATE public.renewalradar_renewals
     SET status = 'expired'
   WHERE status = 'active'
     AND auto_renews = false
     AND next_renewal_date < current_date;

  -- Auto-renewing items advance one billing cycle; alert schedule resets.
  WITH rolled AS (
    UPDATE public.renewalradar_renewals
       SET next_renewal_date = (next_renewal_date + CASE billing_cycle
             WHEN 'weekly'      THEN interval '1 week'
             WHEN 'monthly'     THEN interval '1 month'
             WHEN 'quarterly'   THEN interval '3 months'
             WHEN 'semi_annual' THEN interval '6 months'
             WHEN 'annual'      THEN interval '1 year'
             WHEN 'biennial'    THEN interval '2 years'
             ELSE interval '1 year'
           END)::date,
           last_alert_at = NULL
     WHERE status = 'active'
       AND auto_renews = true
       AND next_renewal_date < current_date
     RETURNING 1
  )
  SELECT count(*)::integer INTO v_rolled FROM rolled;

  RETURN v_rolled;
END;
$$;

-- Cron-only: not callable by end users.
REVOKE EXECUTE ON FUNCTION renewalradar_roll_overdue_renewals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION renewalradar_roll_overdue_renewals() TO service_role;

-- 4.6 Auto-provision profile + free subscription on signup -------------------
-- Never blocks signup: failures are logged, not raised.
CREATE OR REPLACE FUNCTION renewalradar_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.renewalradar_profiles (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(COALESCE(NEW.email, ''), '@', 1)
      ),
      NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Every user always has a billing row → no empty billing state in the app.
    INSERT INTO public.renewalradar_subscriptions (user_id, plan, status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'renewalradar_handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Trigger name is prefixed: auth.users is shared by every product.
CREATE TRIGGER renewalradar_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION renewalradar_handle_new_user();

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
-- profiles
CREATE INDEX idx_renewalradar_profiles_email ON renewalradar_profiles (email);

-- renewals (FK + hot query paths)
CREATE INDEX idx_renewalradar_renewals_user_id
  ON renewalradar_renewals (user_id);
CREATE INDEX idx_renewalradar_renewals_user_next
  ON renewalradar_renewals (user_id, next_renewal_date);
CREATE INDEX idx_renewalradar_renewals_status
  ON renewalradar_renewals (status);
-- Partial: the alert cron's sweep — only active items with a pending alert.
CREATE INDEX idx_renewalradar_renewals_due_alerts
  ON renewalradar_renewals (next_alert_at)
  WHERE status = 'active' AND next_alert_at IS NOT NULL;
-- Partial: the roll function's scan.
CREATE INDEX idx_renewalradar_renewals_overdue
  ON renewalradar_renewals (next_renewal_date)
  WHERE status = 'active';

-- plans (slug UNIQUE already indexed)
CREATE INDEX idx_renewalradar_plans_active
  ON renewalradar_plans (sort_order)
  WHERE is_active = true;

-- subscriptions (user_id / stripe ids UNIQUE already indexed)
CREATE INDEX idx_renewalradar_subscriptions_plan
  ON renewalradar_subscriptions (plan);
CREATE INDEX idx_renewalradar_subscriptions_status
  ON renewalradar_subscriptions (status);
-- Partial: billing-state checks for currently-entitled users.
CREATE INDEX idx_renewalradar_subscriptions_current
  ON renewalradar_subscriptions (current_period_end)
  WHERE status IN ('active', 'trialing', 'past_due');

-- payments
CREATE INDEX idx_renewalradar_payments_user_created
  ON renewalradar_payments (user_id, created_at DESC);
CREATE INDEX idx_renewalradar_payments_status
  ON renewalradar_payments (status);

-- ============================================================================
-- 6. ROW-LEVEL SECURITY
-- ============================================================================
ALTER TABLE renewalradar_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewalradar_renewals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewalradar_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewalradar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewalradar_payments      ENABLE ROW LEVEL SECURITY;

-- 6.1 profiles ----------------------------------------------------------------
CREATE POLICY "Users can view own profile"
  ON renewalradar_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON renewalradar_profiles FOR SELECT TO authenticated
  USING (renewalradar_is_admin());

CREATE POLICY "Users can insert own profile"
  ON renewalradar_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON renewalradar_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 6.2 renewals (full CRUD on own rows) ----------------------------------------
CREATE POLICY "Users can view own renewals"
  ON renewalradar_renewals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own renewals"
  ON renewalradar_renewals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own renewals"
  ON renewalradar_renewals FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own renewals"
  ON renewalradar_renewals FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all renewals"
  ON renewalradar_renewals FOR SELECT TO authenticated
  USING (renewalradar_is_admin());

-- 6.3 plans (public pricing page reads; admins manage; service role bypasses) -
CREATE POLICY "Anyone can view active plans"
  ON renewalradar_plans FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage plans"
  ON renewalradar_plans FOR ALL TO authenticated
  USING (renewalradar_is_admin())
  WITH CHECK (renewalradar_is_admin());

-- 6.4 subscriptions (read own; writes ONLY via service role / Stripe webhooks) -
CREATE POLICY "Users can view own subscription"
  ON renewalradar_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions"
  ON renewalradar_subscriptions FOR SELECT TO authenticated
  USING (renewalradar_is_admin());
-- No INSERT/UPDATE/DELETE policies on purpose: only the service role
-- (which bypasses RLS) mutates billing state from the Stripe webhook handler.

-- 6.5 payments (read own; writes ONLY via service role / Stripe webhooks) -----
CREATE POLICY "Users can view own payments"
  ON renewalradar_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON renewalradar_payments FOR SELECT TO authenticated
  USING (renewalradar_is_admin());
-- No write policies on purpose: service role only.

-- ============================================================================
-- 7. PRIVILEGE HARDENING
-- ----------------------------------------------------------------------------
-- Column-level guard: users may never change their own `role` (or identity
-- columns). RLS gates rows; this gates columns. Service role is unaffected.
-- ============================================================================
REVOKE UPDATE ON renewalradar_profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, default_currency, timezone,
              default_alert_days, onboarding_completed)
  ON renewalradar_profiles TO authenticated;

-- ============================================================================
-- 8. SEED DATA — plan lookup rows (Stripe price IDs filled in by Deploy Mind)
-- ============================================================================
INSERT INTO renewalradar_plans
  (slug, name, description, price_monthly_cents, price_yearly_cents,
   max_renewals, features, is_active, sort_order)
VALUES
  ('free', 'Free',
   'Track up to 5 renewals with email alerts before every charge.',
   0, 0, 5,
   '{"email_alerts": true, "max_alert_windows": 2, "csv_export": false, "slack_alerts": false}'::jsonb,
   true, 0),
  ('pro', 'Pro',
   'Unlimited renewals, custom alert schedules, CSV export, and Slack alerts.',
   900, 8900, NULL,
   '{"email_alerts": true, "max_alert_windows": 6, "csv_export": true, "slack_alerts": true}'::jsonb,
   true, 1),
  ('business', 'Business',
   'Everything in Pro, plus team seats and priority support.',
   2900, 29000, NULL,
   '{"email_alerts": true, "max_alert_windows": 6, "csv_export": true, "slack_alerts": true, "team_seats": 5, "priority_support": true}'::jsonb,
   true, 2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE renewalradar_profiles      IS 'RenewalRadar: user profiles extending auth.users; auto-created on signup.';
COMMENT ON TABLE renewalradar_renewals      IS 'RenewalRadar KERNEL: tracked auto-renewing subscriptions/contracts with embedded alert scheduling.';
COMMENT ON TABLE renewalradar_plans         IS 'RenewalRadar: billing plan lookup; free plan seeded; prices in cents.';
COMMENT ON TABLE renewalradar_subscriptions IS 'RenewalRadar: Stripe subscription state, one row per user; written only by service role via webhooks.';
COMMENT ON TABLE renewalradar_payments      IS 'RenewalRadar: one-time Stripe charges / receipts; written only by service role via webhooks.';

COMMENT ON COLUMN renewalradar_renewals.cancel_by_date  IS 'Generated: last safe day to cancel = next_renewal_date - cancel_notice_days.';
COMMENT ON COLUMN renewalradar_renewals.monthly_amount  IS 'Generated: cost normalized to monthly units for dashboard totals; NULL for custom cycles.';
COMMENT ON COLUMN renewalradar_renewals.next_alert_at   IS 'Maintained by trigger; alert cron sends where next_alert_at <= now() AND status = active, then sets last_alert_at.';
COMMENT ON FUNCTION renewalradar_roll_overdue_renewals() IS 'Daily cron (service role): expires lapsed non-auto-renewing items and rolls auto-renewing items one cycle forward.';

-- Self-validation patches
-- ============================================================================
-- PATCH: self-validation fixes
-- ============================================================================

-- profiles.id must always equal auth.users.id; a random default is a footgun.
ALTER TABLE renewalradar_profiles ALTER COLUMN id DROP DEFAULT;

-- Plan-limit enforcement scans user_id + status IN ('active','paused') on every
-- renewal create; give it a composite index instead of relying on the FK index.
CREATE INDEX IF NOT EXISTS idx_renewalradar_renewals_user_status
  ON renewalradar_renewals (user_id, status);


-- Self-validation patches
-- ============================================================================
-- Self-validation pass 2: NO schema gaps found.
-- Verified: RLS enabled + policies on all 5 tables; column-level UPDATE grants
-- on profiles; service-role-only billing writes; FK + partial indexes cover
-- every hot path (list, alert sweep, roll scan, plan-limit count); signup
-- trigger is non-blocking; roll function EXECUTE revoked from end users.
-- No SQL changes required.


-- Self-validation patches
-- ============================================================================
-- Self-validation pass 3: NO schema changes required.
-- Re-verified: RLS enabled with policies on all 5 tables; column-level UPDATE
-- grants on profiles (role/email/id immutable to end users); billing tables
-- are service-role-write-only by design; every FK and hot query path is
-- indexed (user lists, alert sweep, roll scan, plan-limit count); generated
-- columns (cancel_by_date, monthly_amount) use immutable expressions;
-- SECURITY DEFINER functions pin search_path; roll function EXECUTE revoked
-- from anon/authenticated; plans are seeded before the signup trigger's
-- subscriptions.plan -> plans.slug FK can ever fire.
-- ============================================================================