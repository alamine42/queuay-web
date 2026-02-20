"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function createSchedule(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const appId = formData.get("appId") as string
  const environmentId = formData.get("environmentId") as string
  const name = formData.get("name") as string
  const cronExpression = formData.get("cronExpression") as string
  const timezone = formData.get("timezone") as string || "UTC"
  const journeyIdsStr = formData.get("journeyIds") as string

  const journeyIds = journeyIdsStr ? journeyIdsStr.split(",").filter(Boolean) : []

  // Get app and verify access
  const { data: app } = await supabase
    .from("apps")
    .select("organization_id")
    .eq("id", appId)
    .single()

  if (!app) {
    return { error: "App not found" }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Calculate next run time
  const nextRunAt = calculateNextRun(cronExpression)

  const { data: schedule, error } = await supabase
    .from("scheduled_jobs")
    .insert({
      app_id: appId,
      environment_id: environmentId,
      name,
      cron_expression: cronExpression,
      timezone,
      journey_ids: journeyIds,
      is_enabled: true,
      next_run_at: nextRunAt,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${app.organization_id}/apps/${appId}/schedules`)
  return { success: true, data: schedule }
}

export async function updateSchedule(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const scheduleId = formData.get("scheduleId") as string
  const name = formData.get("name") as string
  const cronExpression = formData.get("cronExpression") as string
  const timezone = formData.get("timezone") as string || "UTC"
  const journeyIdsStr = formData.get("journeyIds") as string
  const isEnabled = formData.get("isEnabled") === "true"

  const journeyIds = journeyIdsStr ? journeyIdsStr.split(",").filter(Boolean) : []

  // Get schedule and verify access
  const { data: schedule } = await supabase
    .from("scheduled_jobs")
    .select("app_id, apps(organization_id)")
    .eq("id", scheduleId)
    .single()

  if (!schedule) {
    return { error: "Schedule not found" }
  }

  const orgId = (schedule.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Calculate next run time
  const nextRunAt = isEnabled ? calculateNextRun(cronExpression) : null

  const { error } = await supabase
    .from("scheduled_jobs")
    .update({
      name,
      cron_expression: cronExpression,
      timezone,
      journey_ids: journeyIds,
      is_enabled: isEnabled,
      next_run_at: nextRunAt,
    })
    .eq("id", scheduleId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${schedule.app_id}/schedules`)
  return { success: true }
}

export async function deleteSchedule(scheduleId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get schedule and verify access
  const { data: schedule } = await supabase
    .from("scheduled_jobs")
    .select("app_id, apps(organization_id)")
    .eq("id", scheduleId)
    .single()

  if (!schedule) {
    return { error: "Schedule not found" }
  }

  const orgId = (schedule.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("id", scheduleId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${schedule.app_id}/schedules`)
  return { success: true }
}

export async function toggleSchedule(scheduleId: string, enabled: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get schedule and verify access
  const { data: schedule } = await supabase
    .from("scheduled_jobs")
    .select("app_id, cron_expression, apps(organization_id)")
    .eq("id", scheduleId)
    .single()

  if (!schedule) {
    return { error: "Schedule not found" }
  }

  const orgId = (schedule.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Calculate next run time if enabling
  const nextRunAt = enabled ? calculateNextRun(schedule.cron_expression) : null

  const { error } = await supabase
    .from("scheduled_jobs")
    .update({
      is_enabled: enabled,
      next_run_at: nextRunAt,
    })
    .eq("id", scheduleId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${schedule.app_id}/schedules`)
  return { success: true }
}

function calculateNextRun(cronExpression: string): string {
  // Simple cron parser for common cases
  // Format: minute hour day-of-month month day-of-week
  const parts = cronExpression.trim().split(/\s+/)

  if (parts.length !== 5) {
    // Default to 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  const [minute, hour] = parts

  const now = new Date()
  const next = new Date(now)

  // Set base time
  if (minute !== "*") {
    next.setMinutes(parseInt(minute, 10))
  }
  if (hour !== "*") {
    next.setHours(parseInt(hour, 10))
  }
  next.setSeconds(0)
  next.setMilliseconds(0)

  // If the calculated time is in the past, move to next day
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }

  return next.toISOString()
}
