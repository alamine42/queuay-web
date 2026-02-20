import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Queue } from "bullmq"
import type { ConnectionOptions } from "bullmq"
import type { TestRunJobData } from "./types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

function getConnectionOptions(): ConnectionOptions {
  const url = new URL(redisUrl)
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

let queue: Queue | null = null

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("test-runs", {
      connection: getConnectionOptions(),
    })
  }
  return queue
}

async function enqueueTestRun(data: TestRunJobData) {
  const q = getQueue()
  return q.add("execute", data, { priority: 1 })
}

export async function checkScheduledJobs(): Promise<void> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

  const now = new Date().toISOString()

  // Get jobs that are due
  const { data: dueJobs, error } = await supabase
    .from("scheduled_jobs")
    .select(`
      *,
      app:apps(organization_id)
    `)
    .eq("is_enabled", true)
    .lte("next_run_at", now)

  if (error) {
    console.error("Failed to fetch scheduled jobs:", error)
    return
  }

  if (!dueJobs || dueJobs.length === 0) {
    return
  }

  console.log(`Found ${dueJobs.length} scheduled jobs to run`)

  for (const job of dueJobs) {
    try {
      const orgId = (job.app as { organization_id: string }).organization_id

      // Create test run
      const { data: testRun, error: runError } = await supabase
        .from("test_runs")
        .insert({
          organization_id: orgId,
          app_id: job.app_id,
          environment_id: job.environment_id,
          trigger_type: "scheduled",
          status: "pending",
        })
        .select()
        .single()

      if (runError || !testRun) {
        console.error(`Failed to create test run for job ${job.id}:`, runError)
        continue
      }

      // Enqueue the test run
      await enqueueTestRun({
        testRunId: testRun.id,
        organizationId: orgId,
        appId: job.app_id,
        environmentId: job.environment_id,
        journeyIds: job.journey_ids,
      })

      // Calculate next run time
      const nextRunAt = calculateNextRun(job.cron_expression, job.timezone)

      // Update job with next run time
      await supabase
        .from("scheduled_jobs")
        .update({
          last_run_at: now,
          next_run_at: nextRunAt,
        })
        .eq("id", job.id)

      console.log(`Scheduled job ${job.id} triggered, next run at ${nextRunAt}`)
    } catch (error) {
      console.error(`Error processing scheduled job ${job.id}:`, error)
    }
  }
}

function calculateNextRun(cronExpression: string, timezone: string): string {
  // Simple cron parser for common cases
  // Format: minute hour day-of-month month day-of-week
  const parts = cronExpression.trim().split(/\s+/)

  if (parts.length !== 5) {
    // Default to 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

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

  // If the calculated time is in the past, move to next occurrence
  if (next <= now) {
    if (hour === "*") {
      // Every hour at minute X
      next.setHours(next.getHours() + 1)
    } else if (dayOfWeek !== "*") {
      // Weekly
      next.setDate(next.getDate() + 7)
    } else if (dayOfMonth !== "*") {
      // Monthly
      next.setMonth(next.getMonth() + 1)
    } else {
      // Daily
      next.setDate(next.getDate() + 1)
    }
  }

  return next.toISOString()
}
