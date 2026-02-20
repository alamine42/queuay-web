import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Box, Play, CheckCircle, XCircle, Clock } from "lucide-react"

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const supabase = await createClient()

  // Verify access to organization
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!membership) {
    redirect("/")
  }

  // Get organization details
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single()

  // Get apps
  const { data: apps } = await supabase
    .from("apps")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // Get recent test runs
  const { data: recentRuns } = await supabase
    .from("test_runs")
    .select(`
      *,
      app:apps(name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Calculate stats
  const totalApps = apps?.length || 0
  const totalRuns = recentRuns?.length || 0
  const passedRuns = recentRuns?.filter((r) => r.status === "completed" && r.stories_failed === 0).length || 0
  const failedRuns = recentRuns?.filter((r) => r.status === "completed" && r.stories_failed > 0).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{org?.name}</h1>
          <p className="text-muted-foreground">Organization Dashboard</p>
        </div>
        <Link href={`/org/${orgId}/apps/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New App
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Runs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedRuns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedRuns}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Apps List */}
        <Card>
          <CardHeader>
            <CardTitle>Apps</CardTitle>
            <CardDescription>Your applications being tested</CardDescription>
          </CardHeader>
          <CardContent>
            {apps && apps.length > 0 ? (
              <div className="space-y-3">
                {apps.map((app) => (
                  <Link
                    key={app.id}
                    href={`/org/${orgId}/apps/${app.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{app.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {app.description || "No description"}
                      </p>
                    </div>
                    <Badge variant="outline">{app.slug}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Box className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No apps yet</p>
                <Link href={`/org/${orgId}/apps/new`}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Create your first app
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Test Runs</CardTitle>
            <CardDescription>Latest test execution results</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRuns && recentRuns.length > 0 ? (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/org/${orgId}/apps/${run.app_id}/runs/${run.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {run.status === "completed" && run.stories_failed === 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : run.status === "completed" && run.stories_failed > 0 ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : run.status === "running" ? (
                        <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{run.app?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {run.stories_passed}/{run.stories_total} passed
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        run.status === "completed" && run.stories_failed === 0
                          ? "success"
                          : run.status === "completed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Play className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No test runs yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
