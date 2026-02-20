import { Queue, QueueEvents, Job } from "bullmq"
import type { ConnectionOptions } from "bullmq"

let testRunQueue: Queue | null = null
let queueEvents: QueueEvents | null = null

function getConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
  const url = new URL(redisUrl)

  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

export function getTestRunQueue(): Queue {
  if (!testRunQueue) {
    testRunQueue = new Queue("test-runs", {
      connection: getConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 1, // We handle retries at the story level
      },
    })
  }
  return testRunQueue
}

export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents("test-runs", {
      connection: getConnectionOptions(),
    })
  }
  return queueEvents
}

export interface TestRunJobData {
  testRunId: string
  organizationId: string
  appId: string
  environmentId: string
  storyIds?: string[]
  journeyIds?: string[]
}

export async function enqueueTestRun(data: TestRunJobData): Promise<Job> {
  const queue = getTestRunQueue()
  return queue.add("execute", data, {
    priority: 1,
  })
}

export async function getJobStatus(jobId: string) {
  const queue = getTestRunQueue()
  const job = await queue.getJob(jobId)
  if (!job) return null

  const state = await job.getState()
  const progress = job.progress

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  }
}

export async function closeConnections() {
  if (testRunQueue) {
    await testRunQueue.close()
    testRunQueue = null
  }
  if (queueEvents) {
    await queueEvents.close()
    queueEvents = null
  }
}
