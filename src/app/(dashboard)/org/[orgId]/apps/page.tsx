import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Box, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default async function AppsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
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

  if (!membership) {
    redirect("/")
  }

  // Get apps with environment count
  const { data: apps } = await supabase
    .from("apps")
    .select(`
      *,
      environments(count),
      journeys(count)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Apps</h1>
          <p className="text-muted-foreground">Manage your applications</p>
        </div>
        <Link href={`/org/${orgId}/apps/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New App
          </Button>
        </Link>
      </div>

      {apps && apps.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/org/${orgId}/apps/${app.id}`}
                      className="hover:underline"
                    >
                      {app.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {app.description || "No description"}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/org/${orgId}/apps/${app.id}/settings`}>
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/org/${orgId}/apps/${app.id}/runs`}>
                        Test Runs
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {(app.environments as { count: number }[])[0]?.count || 0} environments
                  </Badge>
                  <Badge variant="secondary">
                    {(app.journeys as { count: number }[])[0]?.count || 0} journeys
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Box className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No apps yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first app to start testing
            </p>
            <Link href={`/org/${orgId}/apps/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create App
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
