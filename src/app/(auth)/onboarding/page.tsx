"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function OnboardingPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("You must be logged in to create an organization")
      setLoading(false)
      return
    }

    // Create organization with owner using database function
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const { data: orgId, error: orgError } = await supabase
      .rpc("create_organization_with_owner", {
        org_name: orgName,
        org_slug: slug,
        owner_id: user.id,
      })

    if (orgError) {
      setError(orgError.message)
      setLoading(false)
      return
    }

    router.push(`/org/${orgId}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to Queuay</CardTitle>
          <CardDescription>
            Create your organization to get started
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateOrg}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="Acme Inc"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This is your team or company name
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Organization"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
