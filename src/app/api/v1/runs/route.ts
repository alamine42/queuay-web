import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { enqueueTestRun } from "@/lib/queue/client"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    // Get API key from header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid API key" },
        { status: 401 }
      )
    }

    const apiKey = authHeader.replace("Bearer ", "")
    const keyHash = createHash("sha256").update(apiKey).digest("hex")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate API key
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("organization_id, expires_at")
      .eq("key_hash", keyHash)
      .single()

    if (keyError || !apiKeyRecord) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    }

    // Check expiration
    if (
      apiKeyRecord.expires_at &&
      new Date(apiKeyRecord.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "API key expired" },
        { status: 401 }
      )
    }

    // Update last used
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash)

    // Parse request body
    const body = await request.json()
    const { appId, environmentId, journeyIds, storyIds } = body

    if (!appId || !environmentId) {
      return NextResponse.json(
        { error: "appId and environmentId are required" },
        { status: 400 }
      )
    }

    // Verify app belongs to organization
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("organization_id")
      .eq("id", appId)
      .eq("organization_id", apiKeyRecord.organization_id)
      .single()

    if (appError || !app) {
      return NextResponse.json(
        { error: "App not found or access denied" },
        { status: 404 }
      )
    }

    // Get story count
    let storiesCount = 0
    if (storyIds && storyIds.length > 0) {
      const { count } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .in("id", storyIds)
        .eq("is_enabled", true)
      storiesCount = count || 0
    } else if (journeyIds && journeyIds.length > 0) {
      const { count } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .in("journey_id", journeyIds)
        .eq("is_enabled", true)
      storiesCount = count || 0
    } else {
      const { data: journeys } = await supabase
        .from("journeys")
        .select("id")
        .eq("app_id", appId)

      if (journeys && journeys.length > 0) {
        const { count } = await supabase
          .from("stories")
          .select("*", { count: "exact", head: true })
          .in("journey_id", journeys.map((j) => j.id))
          .eq("is_enabled", true)
        storiesCount = count || 0
      }
    }

    // Create test run
    const { data: testRun, error: runError } = await supabase
      .from("test_runs")
      .insert({
        organization_id: apiKeyRecord.organization_id,
        app_id: appId,
        environment_id: environmentId,
        trigger_type: "api",
        status: "pending",
        stories_total: storiesCount,
      })
      .select()
      .single()

    if (runError || !testRun) {
      return NextResponse.json(
        { error: runError?.message || "Failed to create test run" },
        { status: 500 }
      )
    }

    // Enqueue the test run
    await enqueueTestRun({
      testRunId: testRun.id,
      organizationId: apiKeyRecord.organization_id,
      appId,
      environmentId,
      journeyIds,
      storyIds,
    })

    return NextResponse.json({
      id: testRun.id,
      status: testRun.status,
      stories_total: storiesCount,
      created_at: testRun.created_at,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // Get API key from header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid API key" },
        { status: 401 }
      )
    }

    const apiKey = authHeader.replace("Bearer ", "")
    const keyHash = createHash("sha256").update(apiKey).digest("hex")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate API key
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("organization_id")
      .eq("key_hash", keyHash)
      .single()

    if (keyError || !apiKeyRecord) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    }

    // Get run ID from query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get("id")

    if (!runId) {
      // Return recent runs
      const { data: runs, error } = await supabase
        .from("test_runs")
        .select("*")
        .eq("organization_id", apiKeyRecord.organization_id)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ runs })
    }

    // Get specific run
    const { data: run, error } = await supabase
      .from("test_runs")
      .select(`
        *,
        results:test_results(*)
      `)
      .eq("id", runId)
      .eq("organization_id", apiKeyRecord.organization_id)
      .single()

    if (error || !run) {
      return NextResponse.json(
        { error: "Test run not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
