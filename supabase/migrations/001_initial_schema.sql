-- Queuay Web - Initial Database Schema
-- Multi-tenant SaaS for AI-powered QA testing

-- Enable pgcrypto for gen_random_uuid (built into Supabase)

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- =============================================================================
-- ORGANIZATION MEMBERS
-- =============================================================================

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);

-- =============================================================================
-- APPS
-- =============================================================================

CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{"retryCount": 3, "screenshotOnFailure": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_apps_org ON apps(organization_id);

-- =============================================================================
-- ENVIRONMENTS
-- =============================================================================

CREATE TABLE environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  auth_config JSONB DEFAULT '{"type": "none"}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_environments_app ON environments(app_id);

-- Ensure only one default environment per app
CREATE UNIQUE INDEX idx_environments_default ON environments(app_id) WHERE is_default = TRUE;

-- =============================================================================
-- JOURNEYS
-- =============================================================================

CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  preconditions JSONB DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, name)
);

CREATE INDEX idx_journeys_app ON journeys(app_id);
CREATE INDEX idx_journeys_position ON journeys(app_id, position);

-- =============================================================================
-- STORIES
-- =============================================================================

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  preconditions JSONB DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  outcome JSONB NOT NULL DEFAULT '{"description": "", "verifications": []}',
  tags TEXT[] DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  generated_test_code TEXT,
  last_run_at TIMESTAMPTZ,
  last_result VARCHAR(20) CHECK (last_result IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(journey_id, name)
);

CREATE INDEX idx_stories_journey ON stories(journey_id);
CREATE INDEX idx_stories_position ON stories(journey_id, position);
CREATE INDEX idx_stories_tags ON stories USING GIN(tags);

-- =============================================================================
-- TEST RUNS
-- =============================================================================

CREATE TABLE test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'api', 'ci')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  stories_total INTEGER NOT NULL DEFAULT 0,
  stories_passed INTEGER NOT NULL DEFAULT 0,
  stories_failed INTEGER NOT NULL DEFAULT 0,
  stories_skipped INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_runs_org ON test_runs(organization_id);
CREATE INDEX idx_test_runs_app ON test_runs(app_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_created ON test_runs(created_at DESC);

-- =============================================================================
-- TEST RESULTS
-- =============================================================================

CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  journey_name VARCHAR(100) NOT NULL,
  story_name VARCHAR(100) NOT NULL,
  passed BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  steps JSONB DEFAULT '[]',
  error TEXT,
  screenshot_url VARCHAR(500),
  console_errors JSONB DEFAULT '[]',
  heal_proposal JSONB,
  retries INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_results_run ON test_results(test_run_id);
CREATE INDEX idx_test_results_story ON test_results(story_id);
CREATE INDEX idx_test_results_passed ON test_results(passed);

-- =============================================================================
-- SCHEDULED JOBS
-- =============================================================================

CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  journey_ids UUID[] DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_jobs_app ON scheduled_jobs(app_id);
CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_enabled = TRUE;

-- =============================================================================
-- HEAL HISTORY
-- =============================================================================

CREATE TABLE heal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  proposal_type VARCHAR(20) NOT NULL CHECK (proposal_type IN ('selector', 'flow', 'content')),
  original_code TEXT NOT NULL,
  proposed_code TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'applied')),
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_heal_history_story ON heal_history(story_id);
CREATE INDEX idx_heal_history_status ON heal_history(status);

-- =============================================================================
-- API KEYS (for CI/CD integration)
-- =============================================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apps_updated_at
  BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environments_updated_at
  BEFORE UPDATE ON environments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journeys_updated_at
  BEFORE UPDATE ON journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE heal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Helper function to check organization membership
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check organization role
CREATE OR REPLACE FUNCTION get_org_role(org_id UUID)
RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT role FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  USING (get_org_role(id) IN ('owner', 'admin'));

CREATE POLICY "Owners can delete organizations"
  ON organizations FOR DELETE
  USING (get_org_role(id) = 'owner');

-- Organization members policies
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage organization members"
  ON organization_members FOR INSERT
  WITH CHECK (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update organization members"
  ON organization_members FOR UPDATE
  USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can remove organization members"
  ON organization_members FOR DELETE
  USING (get_org_role(organization_id) IN ('owner', 'admin') OR user_id = auth.uid());

-- Apps policies
CREATE POLICY "Members can view apps"
  ON apps FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Members can create apps"
  ON apps FOR INSERT
  WITH CHECK (get_org_role(organization_id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Members can update apps"
  ON apps FOR UPDATE
  USING (get_org_role(organization_id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Admins can delete apps"
  ON apps FOR DELETE
  USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- Environments policies
CREATE POLICY "Members can view environments"
  ON environments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = environments.app_id
    AND is_org_member(apps.organization_id)
  ));

CREATE POLICY "Members can create environments"
  ON environments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = environments.app_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

CREATE POLICY "Members can update environments"
  ON environments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = environments.app_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

CREATE POLICY "Admins can delete environments"
  ON environments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = environments.app_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin')
  ));

-- Journeys policies
CREATE POLICY "Members can view journeys"
  ON journeys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = journeys.app_id
    AND is_org_member(apps.organization_id)
  ));

CREATE POLICY "Members can manage journeys"
  ON journeys FOR ALL
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = journeys.app_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- Stories policies
CREATE POLICY "Members can view stories"
  ON stories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM journeys
    JOIN apps ON apps.id = journeys.app_id
    WHERE journeys.id = stories.journey_id
    AND is_org_member(apps.organization_id)
  ));

CREATE POLICY "Members can manage stories"
  ON stories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM journeys
    JOIN apps ON apps.id = journeys.app_id
    WHERE journeys.id = stories.journey_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- Test runs policies
CREATE POLICY "Members can view test runs"
  ON test_runs FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Members can create test runs"
  ON test_runs FOR INSERT
  WITH CHECK (get_org_role(organization_id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Members can update test runs"
  ON test_runs FOR UPDATE
  USING (get_org_role(organization_id) IN ('owner', 'admin', 'member'));

-- Test results policies
CREATE POLICY "Members can view test results"
  ON test_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM test_runs WHERE test_runs.id = test_results.test_run_id
    AND is_org_member(test_runs.organization_id)
  ));

CREATE POLICY "System can insert test results"
  ON test_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM test_runs WHERE test_runs.id = test_results.test_run_id
    AND is_org_member(test_runs.organization_id)
  ));

-- Scheduled jobs policies
CREATE POLICY "Members can view scheduled jobs"
  ON scheduled_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = scheduled_jobs.app_id
    AND is_org_member(apps.organization_id)
  ));

CREATE POLICY "Members can manage scheduled jobs"
  ON scheduled_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM apps WHERE apps.id = scheduled_jobs.app_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- Heal history policies
CREATE POLICY "Members can view heal history"
  ON heal_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM stories
    JOIN journeys ON journeys.id = stories.journey_id
    JOIN apps ON apps.id = journeys.app_id
    WHERE stories.id = heal_history.story_id
    AND is_org_member(apps.organization_id)
  ));

CREATE POLICY "Members can manage heal history"
  ON heal_history FOR ALL
  USING (EXISTS (
    SELECT 1 FROM stories
    JOIN journeys ON journeys.id = stories.journey_id
    JOIN apps ON apps.id = journeys.app_id
    WHERE stories.id = heal_history.story_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- API keys policies
CREATE POLICY "Admins can view API keys"
  ON api_keys FOR SELECT
  USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can manage API keys"
  ON api_keys FOR ALL
  USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- =============================================================================
-- STORAGE BUCKET FOR SCREENSHOTS
-- =============================================================================

-- Note: Run this in Supabase dashboard SQL editor or via CLI
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('screenshots', 'screenshots', true);

-- CREATE POLICY "Anyone can view screenshots"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'screenshots');

-- CREATE POLICY "Authenticated users can upload screenshots"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
