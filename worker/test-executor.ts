import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { executeStory } from "./execute-story"
import type { TestRunJobData } from "../src/lib/queue/client"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ProgressUpdate {
  total: number
  completed: number
  passed: number
  failed: number
  current?: string
}

export async function executeTestRun(
  data: TestRunJobData,
  onProgress: (progress: ProgressUpdate) => void
): Promise<void> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

  // Get test run
  const { data: testRun, error: runError } = await supabase
    .from("test_runs")
    .select("*")
    .eq("id", data.testRunId)
    .single()

  if (runError || !testRun) {
    throw new Error(`Test run not found: ${data.testRunId}`)
  }

  // Get environment
  const { data: environment, error: envError } = await supabase
    .from("environments")
    .select("*")
    .eq("id", data.environmentId)
    .single()

  if (envError || !environment) {
    throw new Error(`Environment not found: ${data.environmentId}`)
  }

  // Get stories to run
  let storiesQuery = supabase
    .from("stories")
    .select(`
      *,
      journey:journeys(name, title)
    `)
    .eq("is_enabled", true)

  if (data.storyIds && data.storyIds.length > 0) {
    storiesQuery = storiesQuery.in("id", data.storyIds)
  } else if (data.journeyIds && data.journeyIds.length > 0) {
    storiesQuery = storiesQuery.in("journey_id", data.journeyIds)
  } else {
    // Get all stories for the app
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id")
      .eq("app_id", data.appId)

    if (journeys && journeys.length > 0) {
      storiesQuery = storiesQuery.in(
        "journey_id",
        journeys.map((j) => j.id)
      )
    }
  }

  const { data: stories, error: storiesError } = await storiesQuery.order(
    "position"
  )

  if (storiesError) {
    throw new Error(`Failed to fetch stories: ${storiesError.message}`)
  }

  if (!stories || stories.length === 0) {
    // No stories to run, mark as completed
    await supabase
      .from("test_runs")
      .update({
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        stories_total: 0,
        stories_passed: 0,
        stories_failed: 0,
      })
      .eq("id", data.testRunId)
    return
  }

  // Update test run status to running
  const startedAt = new Date().toISOString()
  await supabase
    .from("test_runs")
    .update({
      status: "running",
      started_at: startedAt,
      stories_total: stories.length,
    })
    .eq("id", data.testRunId)

  // Execute stories
  let passed = 0
  let failed = 0

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i]
    const journey = story.journey as { name: string; title: string }

    onProgress({
      total: stories.length,
      completed: i,
      passed,
      failed,
      current: story.title,
    })

    try {
      const result = await executeStory(story, environment.base_url, {
        retryCount: 3,
        screenshotOnFailure: true,
      })

      // Save result
      await supabase.from("test_results").insert({
        test_run_id: data.testRunId,
        story_id: story.id,
        journey_name: journey.name,
        story_name: story.name,
        passed: result.passed,
        duration_ms: result.duration_ms,
        steps: result.steps,
        error: result.error,
        screenshot_url: result.screenshot_url,
        console_errors: result.console_errors,
        heal_proposal: result.heal_proposal,
        retries: result.retries,
      })

      // Update story last run info
      await supabase
        .from("stories")
        .update({
          last_run_at: new Date().toISOString(),
          last_result: result.passed ? "passed" : "failed",
        })
        .eq("id", story.id)

      if (result.passed) {
        passed++
      } else {
        failed++
      }

      // Update test run progress
      await supabase
        .from("test_runs")
        .update({
          stories_passed: passed,
          stories_failed: failed,
        })
        .eq("id", data.testRunId)
    } catch (error) {
      failed++
      console.error(`Story ${story.id} execution error:`, error)

      // Save error result
      await supabase.from("test_results").insert({
        test_run_id: data.testRunId,
        story_id: story.id,
        journey_name: journey.name,
        story_name: story.name,
        passed: false,
        duration_ms: 0,
        error: error instanceof Error ? error.message : String(error),
        retries: 0,
      })

      // Update story last run info
      await supabase
        .from("stories")
        .update({
          last_run_at: new Date().toISOString(),
          last_result: "failed",
        })
        .eq("id", story.id)
    }
  }

  // Mark test run as completed
  const completedAt = new Date().toISOString()
  const durationMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime()

  await supabase
    .from("test_runs")
    .update({
      status: "completed",
      completed_at: completedAt,
      duration_ms: durationMs,
      stories_passed: passed,
      stories_failed: failed,
    })
    .eq("id", data.testRunId)

  onProgress({
    total: stories.length,
    completed: stories.length,
    passed,
    failed,
  })
}
