import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StoryList } from "@/components/journey/story-list"
import { Plus, Play, Settings, ArrowLeft } from "lucide-react"

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ orgId: string; appId: string; journeyId: string }>
}) {
  const { orgId, appId, journeyId } = await params
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

  // Get journey with stories
  const { data: journey } = await supabase
    .from("journeys")
    .select(`
      *,
      apps(name, organization_id),
      stories(*)
    `)
    .eq("id", journeyId)
    .eq("app_id", appId)
    .single()

  if (!journey) redirect(`/org/${orgId}/apps/${appId}/journeys`)

  const stories = (journey.stories as any[]).sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/org/${orgId}/apps/${appId}/journeys`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{journey.title}</h1>
            <Badge variant="outline">{journey.name}</Badge>
          </div>
          <p className="text-muted-foreground">
            {journey.description || "No description"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/org/${orgId}/apps/${appId}/journeys/${journeyId}/stories/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Story
            </Button>
          </Link>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Journey Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stories.filter((s) => s.is_enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stories.filter((s) => s.last_result === "passed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stories.filter((s) => s.last_result === "failed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stories List */}
      <Card>
        <CardHeader>
          <CardTitle>Stories</CardTitle>
          <CardDescription>
            Test scenarios in this journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StoryList
            stories={stories}
            journeyId={journeyId}
            orgId={orgId}
            appId={appId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
