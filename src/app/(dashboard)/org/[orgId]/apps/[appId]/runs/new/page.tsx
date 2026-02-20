"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { triggerTestRun } from "@/app/actions/test-runs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Play, Loader2 } from "lucide-react"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Environment {
  id: string
  name: string
  is_default: boolean
}

interface Journey {
  id: string
  title: string
  stories: { id: string; title: string; is_enabled: boolean }[]
}

export default function NewTestRunPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const appId = params.appId as string

  const [environments, setEnvironments] = useState<Environment[]>([])
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [selectedEnv, setSelectedEnv] = useState<string>("")
  const [selectedJourneys, setSelectedJourneys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // Load environments
      const { data: envs } = await supabase
        .from("environments")
        .select("id, name, is_default")
        .eq("app_id", appId)
        .order("is_default", { ascending: false })

      if (envs) {
        setEnvironments(envs)
        const defaultEnv = envs.find((e) => e.is_default)
        if (defaultEnv) {
          setSelectedEnv(defaultEnv.id)
        }
      }

      // Load journeys with stories
      const { data: jnys } = await supabase
        .from("journeys")
        .select(`
          id,
          title,
          stories(id, title, is_enabled)
        `)
        .eq("app_id", appId)
        .order("position")

      if (jnys) {
        setJourneys(jnys as Journey[])
        // Select all journeys by default
        setSelectedJourneys(jnys.map((j) => j.id))
      }

      setLoading(false)
    }

    loadData()
  }, [appId])

  const handleJourneyToggle = (journeyId: string, checked: boolean) => {
    if (checked) {
      setSelectedJourneys([...selectedJourneys, journeyId])
    } else {
      setSelectedJourneys(selectedJourneys.filter((id) => id !== journeyId))
    }
  }

  const handleSelectAll = () => {
    setSelectedJourneys(journeys.map((j) => j.id))
  }

  const handleSelectNone = () => {
    setSelectedJourneys([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const formData = new FormData()
    formData.set("orgId", orgId)
    formData.set("appId", appId)
    formData.set("environmentId", selectedEnv)
    formData.set("journeyIds", selectedJourneys.join(","))

    const result = await triggerTestRun(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  const enabledStoriesCount = journeys
    .filter((j) => selectedJourneys.includes(j.id))
    .reduce(
      (acc, j) => acc + j.stories.filter((s) => s.is_enabled).length,
      0
    )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/org/${orgId}/apps/${appId}/runs`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Test Runs
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Tests
          </CardTitle>
          <CardDescription>
            Configure and start a new test run
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Environment Selection */}
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                      {env.is_default && " (default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Journey Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Journeys to Run</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectNone}
                  >
                    Select None
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {journeys.length > 0 ? (
                  journeys.map((journey) => {
                    const enabledStories = journey.stories.filter(
                      (s) => s.is_enabled
                    )
                    return (
                      <div
                        key={journey.id}
                        className="flex items-center space-x-2 py-1"
                      >
                        <Checkbox
                          id={journey.id}
                          checked={selectedJourneys.includes(journey.id)}
                          onCheckedChange={(checked) =>
                            handleJourneyToggle(journey.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={journey.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                        >
                          {journey.title}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {enabledStories.length} stories
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No journeys found. Create a journey first.
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium">Summary</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedJourneys.length} journeys selected •{" "}
                {enabledStoriesCount} stories to run
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Link href={`/org/${orgId}/apps/${appId}/runs`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={
                submitting ||
                !selectedEnv ||
                selectedJourneys.length === 0 ||
                enabledStoriesCount === 0
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run {enabledStoriesCount} Stories
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
