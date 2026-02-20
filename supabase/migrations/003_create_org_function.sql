-- Create a function to handle organization creation + member addition atomically
-- This bypasses RLS using SECURITY DEFINER

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  owner_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Insert organization
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  -- Insert owner as member
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, owner_id, 'owner');

  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_owner TO authenticated;
