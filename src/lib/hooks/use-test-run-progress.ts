"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TestRun, TestResult } from "@/lib/types"

interface UseTestRunProgressOptions {
  testRunId: string
  initialRun?: TestRun
  initialResults?: TestResult[]
}

interface UseTestRunProgressResult {
  testRun: TestRun | null
  results: TestResult[]
  loading: boolean
  error: string | null
}

export function useTestRunProgress({
  testRunId,
  initialRun,
  initialResults = [],
}: UseTestRunProgressOptions): UseTestRunProgressResult {
  const [testRun, setTestRun] = useState<TestRun | null>(initialRun || null)
  const [results, setResults] = useState<TestResult[]>(initialResults)
  const [loading, setLoading] = useState(!initialRun)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Load initial data if not provided
    async function loadInitialData() {
      if (!initialRun) {
        const { data, error } = await supabase
          .from("test_runs")
          .select("*")
          .eq("id", testRunId)
          .single()

        if (error) {
          setError(error.message)
        } else {
          setTestRun(data)
        }
      }

      if (initialResults.length === 0) {
        const { data } = await supabase
          .from("test_results")
          .select("*")
          .eq("test_run_id", testRunId)
          .order("created_at")

        if (data) {
          setResults(data)
        }
      }

      setLoading(false)
    }

    loadInitialData()

    // Subscribe to test run updates
    const runChannel = supabase
      .channel(`test-run-${testRunId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "test_runs",
          filter: `id=eq.${testRunId}`,
        },
        (payload) => {
          setTestRun(payload.new as TestRun)
        }
      )
      .subscribe()

    // Subscribe to test result inserts
    const resultsChannel = supabase
      .channel(`test-results-${testRunId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "test_results",
          filter: `test_run_id=eq.${testRunId}`,
        },
        (payload) => {
          setResults((prev) => [...prev, payload.new as TestResult])
        }
      )
      .subscribe()

    return () => {
      runChannel.unsubscribe()
      resultsChannel.unsubscribe()
    }
  }, [testRunId, initialRun, initialResults])

  return { testRun, results, loading, error }
}
