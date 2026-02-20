import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDuration } from "@/lib/utils"
import {
  Plus,
  Play,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  BookOpen,
} from "lucide-react"

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string; appId: string }>
}) {
  const { orgId, appId } = await params
  const supabase = await createClient()

  // Verify access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership) redirect("/")

  // Get app with related data
  const { data: app } = await supabase
    .from("apps")
    .select("*")
    .eq("id", appId)
    .eq("organization_id", orgId)
    .single()

  if (!app) redirect(`/org/${orgId}`)

  // Get environments
  const { data: environments } = await supabase
    .from("environments")
    .select("*")
    .eq("app_id", appId)
    .order("is_default", { ascending: false })

  // Get journeys with story counts
  const { data: journeys } = await supabase
    .from("journeys")
    .select(`
      *,
      stories(count)
    `)
    .eq("app_id", appId)
    .order("position")

  // Get recent test runs
  const { data: recentRuns } = await supabase
    .from("test_runs")
    .select(`
      *,
      environment:environments(name)
    `)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Calculate stats
  const totalJourneys = journeys?.length || 0
  const totalStories = journeys?.reduce(
    (acc, j) => acc + ((j.stories as { count: number }[])[0]?.count || 0),
    0
  ) || 0
  const lastRun = recentRuns?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{app.name}</h1>
          <p className="text-muted-foreground">
            {app.description || "No description"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Run Tests
            </Button>
          </Link>
          <Link href={`/org/${orgId}/apps/${appId}/settings`}>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environments</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{environments?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Journeys</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalJourneys}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            {lastRun?.status === "completed" && lastRun.stories_failed === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : lastRun?.status === "completed" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastRun
                ? lastRun.status === "completed"
                  ? `${lastRun.stories_passed}/${lastRun.stories_total}`
                  : lastRun.status
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Environments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Environments</CardTitle>
              <CardDescription>Test environments for this app</CardDescription>
            </div>
            <Link href={`/org/${orgId}/apps/${appId}/settings`}>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {environments && environments.length > 0 ? (
              <div className="space-y-3">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{env.name}</p>
                        {env.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {env.base_url}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No environments yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Journeys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Journeys</CardTitle>
              <CardDescription>Test journey groups</CardDescription>
            </div>
            <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {journeys && journeys.length > 0 ? (
              <div className="space-y-3">
                {journeys.map((journey) => (
                  <Link
                    key={journey.id}
                    href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{journey.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {(journey.stories as { count: number }[])[0]?.count || 0} stories
                      </p>
                    </div>
                    <Badge variant="outline">{journey.name}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No journeys yet</p>
                <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Create your first journey
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Test Runs</CardTitle>
            <CardDescription>Latest test execution results</CardDescription>
          </div>
          <Link href={`/org/${orgId}/apps/${appId}/runs`}>
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentRuns && recentRuns.length > 0 ? (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/org/${orgId}/apps/${appId}/runs/${run.id}`}
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
                      <p className="font-medium">
                        {run.environment?.name || "Unknown"} Environment
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {run.stories_passed}/{run.stories_total} passed
                        {run.duration_ms && ` • ${formatDuration(run.duration_ms)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Play className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No test runs yet</p>
              <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
                <Button variant="outline" size="sm" className="mt-2">
                  Run your first test
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
