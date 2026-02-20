"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

export async function createJourney(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const appId = formData.get("appId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string

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

  // Get max position
  const { data: maxPos } = await supabase
    .from("journeys")
    .select("position")
    .eq("app_id", appId)
    .order("position", { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1
  const name = slugify(title)

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      app_id: appId,
      name,
      title,
      description,
      position,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${app.organization_id}/apps/${appId}`)
  return { success: true, data: journey }
}

export async function updateJourney(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const journeyId = formData.get("journeyId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string

  // Get journey and verify access
  const { data: journey } = await supabase
    .from("journeys")
    .select("app_id, apps(organization_id)")
    .eq("id", journeyId)
    .single()

  if (!journey) {
    return { error: "Journey not found" }
  }

  const orgId = (journey.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("journeys")
    .update({ title, description })
    .eq("id", journeyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journey.app_id}`)
  return { success: true }
}

export async function deleteJourney(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const journeyId = formData.get("journeyId") as string

  // Get journey and verify access
  const { data: journey } = await supabase
    .from("journeys")
    .select("app_id, apps(organization_id)")
    .eq("id", journeyId)
    .single()

  if (!journey) {
    return { error: "Journey not found" }
  }

  const orgId = (journey.apps as unknown as { organization_id: string }).organization_id

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
    .from("journeys")
    .delete()
    .eq("id", journeyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journey.app_id}`)
  redirect(`/org/${orgId}/apps/${journey.app_id}`)
}

export async function reorderJourneys(appId: string, journeyIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

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

  // Update positions
  for (let i = 0; i < journeyIds.length; i++) {
    await supabase
      .from("journeys")
      .update({ position: i })
      .eq("id", journeyIds[i])
  }

  revalidatePath(`/org/${app.organization_id}/apps/${appId}`)
  return { success: true }
}
