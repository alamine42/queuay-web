"use client"

import { useState } from "react"
import { createSchedule } from "@/app/actions/schedules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Loader2, Calendar } from "lucide-react"
import cronstrue from "cronstrue"

interface CreateScheduleDialogProps {
  appId: string
  environments: { id: string; name: string }[]
  journeys: { id: string; title: string }[]
}

const COMMON_SCHEDULES = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Every day at midnight", cron: "0 0 * * *" },
  { label: "Every day at 9 AM", cron: "0 9 * * *" },
  { label: "Every Monday at 9 AM", cron: "0 9 * * 1" },
  { label: "Every weekday at 9 AM", cron: "0 9 * * 1-5" },
]

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]

export function CreateScheduleDialog({
  appId,
  environments,
  journeys,
}: CreateScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [environmentId, setEnvironmentId] = useState(environments[0]?.id || "")
  const [cronExpression, setCronExpression] = useState("0 0 * * *")
  const [timezone, setTimezone] = useState("UTC")
  const [selectedJourneys, setSelectedJourneys] = useState<string[]>(
    journeys.map((j) => j.id)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJourneyToggle = (journeyId: string, checked: boolean) => {
    if (checked) {
      setSelectedJourneys([...selectedJourneys, journeyId])
    } else {
      setSelectedJourneys(selectedJourneys.filter((id) => id !== journeyId))
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set("appId", appId)
    formData.set("environmentId", environmentId)
    formData.set("name", name)
    formData.set("cronExpression", cronExpression)
    formData.set("timezone", timezone)
    formData.set("journeyIds", selectedJourneys.join(","))

    const result = await createSchedule(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setOpen(false)
    setLoading(false)
    // Reset form
    setName("")
    setCronExpression("0 0 * * *")
    setSelectedJourneys(journeys.map((j) => j.id))
  }

  const formatCron = (expression: string): string => {
    try {
      return cronstrue.toString(expression)
    } catch {
      return "Invalid cron expression"
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Schedule
          </DialogTitle>
          <DialogDescription>
            Set up automated test runs on a schedule
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Schedule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily regression tests"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Select value={environmentId} onValueChange={setEnvironmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={
                COMMON_SCHEDULES.find((s) => s.cron === cronExpression)?.cron ||
                "custom"
              }
              onValueChange={(value) => {
                if (value !== "custom") {
                  setCronExpression(value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SCHEDULES.map((schedule) => (
                  <SelectItem key={schedule.cron} value={schedule.cron}>
                    {schedule.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom cron expression</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <Input
                id="cron"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 0 * * *"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {formatCron(cronExpression)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Journeys to Run</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
              {journeys.map((journey) => (
                <div
                  key={journey.id}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`journey-${journey.id}`}
                    checked={selectedJourneys.includes(journey.id)}
                    onCheckedChange={(checked) =>
                      handleJourneyToggle(journey.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`journey-${journey.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {journey.title}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !name ||
              !environmentId ||
              !cronExpression ||
              selectedJourneys.length === 0
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Schedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
