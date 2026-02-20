import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScheduleList } from "@/components/schedule/schedule-list"
import { CreateScheduleDialog } from "@/components/schedule/create-schedule-dialog"
import { Plus, Calendar, Clock } from "lucide-react"
import cronstrue from "cronstrue"

export default async function SchedulesPage({
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

  // Get environments
  const { data: environments } = await supabase
    .from("environments")
    .select("id, name")
    .eq("app_id", appId)
    .order("is_default", { ascending: false })

  // Get journeys
  const { data: journeys } = await supabase
    .from("journeys")
    .select("id, title")
    .eq("app_id", appId)
    .order("position")

  // Get schedules
  const { data: schedules } = await supabase
    .from("scheduled_jobs")
    .select(`
      *,
      environment:environments(name)
    `)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">
            Automated test schedules for {app.name}
          </p>
        </div>
        <CreateScheduleDialog
          appId={appId}
          environments={environments || []}
          journeys={journeys || []}
        />
      </div>

      {schedules && schedules.length > 0 ? (
        <ScheduleList schedules={schedules} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No schedules yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a schedule to run tests automatically
            </p>
            <CreateScheduleDialog
              appId={appId}
              environments={environments || []}
              journeys={journeys || []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
