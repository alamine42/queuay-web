-- Fix organization_members RLS policy to allow first owner creation

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_members;

-- Create new policy that allows:
-- 1. Existing admins/owners to add members
-- 2. Users to add themselves as owner if org has no members yet
CREATE POLICY "Users can add first owner or admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    -- Allow if user is adding themselves as owner to an org with no members
    (
      user_id = auth.uid()
      AND role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
      )
    )
    -- Or allow if user is already an admin/owner of the org
    OR get_org_role(organization_id) IN ('owner', 'admin')
  );
