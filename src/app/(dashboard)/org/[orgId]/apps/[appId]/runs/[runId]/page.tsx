import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TestRunProgress } from "@/components/test-run/live-progress"
import { ResultsList } from "@/components/test-run/results-list"
import { formatDuration } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  RefreshCw,
} from "lucide-react"

export default async function TestRunPage({
  params,
}: {
  params: Promise<{ orgId: string; appId: string; runId: string }>
}) {
  const { orgId, appId, runId } = await params
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

  // Get test run
  const { data: testRun } = await supabase
    .from("test_runs")
    .select(`
      *,
      environment:environments(name, base_url),
      app:apps(name)
    `)
    .eq("id", runId)
    .eq("app_id", appId)
    .single()

  if (!testRun) redirect(`/org/${orgId}/apps/${appId}/runs`)

  // Get test results
  const { data: results } = await supabase
    .from("test_results")
    .select(`
      *,
      story:stories(title, journey_id)
    `)
    .eq("test_run_id", runId)
    .order("created_at")

  const isInProgress =
    testRun.status === "pending" || testRun.status === "running"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/org/${orgId}/apps/${appId}/runs`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              Test Run on {testRun.environment?.name}
            </h1>
            <Badge
              variant={
                testRun.status === "completed" && testRun.stories_failed === 0
                  ? "success"
                  : testRun.status === "completed"
                  ? "destructive"
                  : testRun.status === "running"
                  ? "default"
                  : "secondary"
              }
            >
              {testRun.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {testRun.trigger_type === "manual" && "Manual run"}
            {testRun.trigger_type === "scheduled" && "Scheduled run"}
            {testRun.trigger_type === "api" && "API trigger"}
            {testRun.trigger_type === "ci" && "CI/CD trigger"}
            {" • "}
            {new Date(testRun.created_at).toLocaleString()}
          </p>
        </div>
        <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Run Again
          </Button>
        </Link>
      </div>

      {/* Progress Bar for in-progress runs */}
      {isInProgress && (
        <TestRunProgress
          testRunId={runId}
          initialRun={testRun}
          initialResults={results || []}
        />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testRun.stories_total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {testRun.stories_passed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {testRun.stories_failed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Skipped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {testRun.stories_skipped || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testRun.duration_ms ? formatDuration(testRun.duration_ms) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results List */}
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Individual test story results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResultsList
            results={results || []}
            orgId={orgId}
            appId={appId}
            runId={runId}
            isInProgress={isInProgress}
          />
        </CardContent>
      </Card>
    </div>
  )
}
