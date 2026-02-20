"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

export async function createApp(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const orgId = formData.get("orgId") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const baseUrl = formData.get("baseUrl") as string

  // Verify membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const slug = slugify(name)

  // Create app
  const { data: app, error: appError } = await supabase
    .from("apps")
    .insert({
      organization_id: orgId,
      name,
      slug,
      description,
    })
    .select()
    .single()

  if (appError) {
    return { error: appError.message }
  }

  // Create default environment
  const { error: envError } = await supabase
    .from("environments")
    .insert({
      app_id: app.id,
      name: "Production",
      base_url: baseUrl,
      is_default: true,
    })

  if (envError) {
    return { error: envError.message }
  }

  revalidatePath(`/org/${orgId}`)
  redirect(`/org/${orgId}/apps/${app.id}`)
}

export async function updateApp(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const appId = formData.get("appId") as string
  const name = formData.get("name") as string
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

  const { error } = await supabase
    .from("apps")
    .update({ name, description })
    .eq("id", appId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${app.organization_id}/apps/${appId}`)
  return { success: true }
}

export async function deleteApp(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const appId = formData.get("appId") as string

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

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("apps")
    .delete()
    .eq("id", appId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${app.organization_id}`)
  redirect(`/org/${app.organization_id}`)
}

export async function createEnvironment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const appId = formData.get("appId") as string
  const name = formData.get("name") as string
  const baseUrl = formData.get("baseUrl") as string
  const isDefault = formData.get("isDefault") === "true"

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

  // If setting as default, unset other defaults
  if (isDefault) {
    await supabase
      .from("environments")
      .update({ is_default: false })
      .eq("app_id", appId)
  }

  const { data: env, error } = await supabase
    .from("environments")
    .insert({
      app_id: appId,
      name,
      base_url: baseUrl,
      is_default: isDefault,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${app.organization_id}/apps/${appId}`)
  return { success: true, data: env }
}

export async function updateEnvironment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const envId = formData.get("envId") as string
  const name = formData.get("name") as string
  const baseUrl = formData.get("baseUrl") as string
  const isDefault = formData.get("isDefault") === "true"

  // Get environment and app
  const { data: env } = await supabase
    .from("environments")
    .select("app_id, apps(organization_id)")
    .eq("id", envId)
    .single()

  if (!env) {
    return { error: "Environment not found" }
  }

  const orgId = (env.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await supabase
      .from("environments")
      .update({ is_default: false })
      .eq("app_id", env.app_id)
  }

  const { error } = await supabase
    .from("environments")
    .update({ name, base_url: baseUrl, is_default: isDefault })
    .eq("id", envId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${env.app_id}`)
  return { success: true }
}

export async function deleteEnvironment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const envId = formData.get("envId") as string

  // Get environment and app
  const { data: env } = await supabase
    .from("environments")
    .select("app_id, is_default, apps(organization_id)")
    .eq("id", envId)
    .single()

  if (!env) {
    return { error: "Environment not found" }
  }

  if (env.is_default) {
    return { error: "Cannot delete default environment" }
  }

  const orgId = (env.apps as unknown as { organization_id: string }).organization_id

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
    .from("environments")
    .delete()
    .eq("id", envId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${env.app_id}`)
  return { success: true }
}
