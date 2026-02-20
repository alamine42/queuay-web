import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, BookOpen, CheckCircle, XCircle, Minus } from "lucide-react"

export default async function JourneysPage({
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

  // Get journeys with stories
  const { data: journeys } = await supabase
    .from("journeys")
    .select(`
      *,
      stories(id, title, is_enabled, last_result)
    `)
    .eq("app_id", appId)
    .order("position")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journeys</h1>
          <p className="text-muted-foreground">Test journeys for {app.name}</p>
        </div>
        <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Journey
          </Button>
        </Link>
      </div>

      {journeys && journeys.length > 0 ? (
        <div className="space-y-4">
          {journeys.map((journey) => {
            const stories = journey.stories as {
              id: string
              title: string
              is_enabled: boolean
              last_result: string | null
            }[]
            const enabledStories = stories.filter((s) => s.is_enabled)
            const passedStories = enabledStories.filter((s) => s.last_result === "passed")
            const failedStories = enabledStories.filter((s) => s.last_result === "failed")

            return (
              <Card key={journey.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        <Link
                          href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}`}
                          className="hover:underline"
                        >
                          {journey.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {journey.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{journey.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {stories.length} stories
                    </span>
                    {passedStories.length > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {passedStories.length} passed
                      </span>
                    )}
                    {failedStories.length > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        {failedStories.length} failed
                      </span>
                    )}
                    {enabledStories.length - passedStories.length - failedStories.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Minus className="h-4 w-4" />
                        {enabledStories.length - passedStories.length - failedStories.length} pending
                      </span>
                    )}
                  </div>

                  {stories.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {stories.slice(0, 5).map((story) => (
                        <Link
                          key={story.id}
                          href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}`}
                          className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors"
                        >
                          <span className={!story.is_enabled ? "text-muted-foreground" : ""}>
                            {story.title}
                          </span>
                          {story.last_result === "passed" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {story.last_result === "failed" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {!story.is_enabled && (
                            <Badge variant="secondary" className="text-xs">
                              Disabled
                            </Badge>
                          )}
                        </Link>
                      ))}
                      {stories.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{stories.length - 5} more stories
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Link href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}`}>
                      <Button variant="outline" size="sm">
                        View Stories
                      </Button>
                    </Link>
                    <Link href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}/stories/new`}>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Story
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No journeys yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first journey to organize your test stories
            </p>
            <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Journey
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
