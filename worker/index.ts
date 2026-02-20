import { Worker, Job } from "bullmq"
import type { ConnectionOptions } from "bullmq"
import { executeTestRun } from "./test-executor"
import { checkScheduledJobs } from "./scheduler"
import type { TestRunJobData } from "./types"

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "3", 10)

function getConnectionOptions(): ConnectionOptions {
  const url = new URL(redisUrl)

  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

const connection = getConnectionOptions()

console.log(`Starting Queuay Worker...`)
console.log(`Redis URL: ${redisUrl}`)
console.log(`Concurrency: ${concurrency}`)

// Create worker for test runs
const worker = new Worker<TestRunJobData>(
  "test-runs",
  async (job: Job<TestRunJobData>) => {
    console.log(`Processing job ${job.id}: test run ${job.data.testRunId}`)

    try {
      await executeTestRun(job.data, (progress) => {
        job.updateProgress(progress)
      })
      console.log(`Job ${job.id} completed successfully`)
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error)
      throw error
    }
  },
  {
    connection,
    concurrency,
  }
)

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`)
})

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message)
})

worker.on("error", (err) => {
  console.error("Worker error:", err)
})

// Start scheduler check every minute
const schedulerInterval = setInterval(async () => {
  try {
    await checkScheduledJobs()
  } catch (error) {
    console.error("Scheduler check failed:", error)
  }
}, 60 * 1000)

// Handle shutdown
async function shutdown() {
  console.log("Shutting down worker...")
  clearInterval(schedulerInterval)
  await worker.close()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

console.log("Worker started and waiting for jobs...")
