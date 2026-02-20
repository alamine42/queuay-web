import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDuration } from "@/lib/utils"
import { Plus, Play, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"

export default async function TestRunsPage({
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

  // Get app
  const { data: app } = await supabase
    .from("apps")
    .select("name")
    .eq("id", appId)
    .eq("organization_id", orgId)
    .single()

  if (!app) redirect(`/org/${orgId}`)

  // Get test runs
  const { data: runs } = await supabase
    .from("test_runs")
    .select(`
      *,
      environment:environments(name)
    `)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Runs</h1>
          <p className="text-muted-foreground">Test execution history for {app.name}</p>
        </div>
        <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Run Tests
          </Button>
        </Link>
      </div>

      {runs && runs.length > 0 ? (
        <div className="space-y-4">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/org/${orgId}/apps/${appId}/runs/${run.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    {run.status === "completed" && run.stories_failed === 0 ? (
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    ) : run.status === "completed" && run.stories_failed > 0 ? (
                      <XCircle className="h-8 w-8 text-red-500" />
                    ) : run.status === "running" ? (
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-8 w-8 text-red-500" />
                    ) : (
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    )}

                    {/* Run Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {run.environment?.name || "Unknown"} Environment
                        </span>
                        <Badge
                          variant={
                            run.status === "completed" && run.stories_failed === 0
                              ? "success"
                              : run.status === "completed"
                              ? "destructive"
                              : run.status === "running"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {run.trigger_type === "manual" && "Manual trigger"}
                        {run.trigger_type === "scheduled" && "Scheduled run"}
                        {run.trigger_type === "api" && "API trigger"}
                        {run.trigger_type === "ci" && "CI/CD trigger"}
                        {" • "}
                        {new Date(run.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {run.stories_total}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {run.stories_passed}
                      </div>
                      <div className="text-xs text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {run.stories_failed}
                      </div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    {run.duration_ms && (
                      <div className="text-center">
                        <div className="text-lg font-medium">
                          {formatDuration(run.duration_ms)}
                        </div>
                        <div className="text-xs text-muted-foreground">Duration</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No test runs yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Run your first test to see results here
            </p>
            <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Run Tests
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
