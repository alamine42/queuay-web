"use client"

import { useState } from "react"
import { toggleSchedule, deleteSchedule } from "@/app/actions/schedules"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar, Clock, MoreVertical, Pencil, Trash, Play } from "lucide-react"
import cronstrue from "cronstrue"
import type { ScheduledJob } from "@/lib/types"

interface ScheduleListProps {
  schedules: (ScheduledJob & { environment?: { name: string } })[]
}

export function ScheduleList({ schedules }: ScheduleListProps) {
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleToggle = async (scheduleId: string, enabled: boolean) => {
    setToggling(scheduleId)
    await toggleSchedule(scheduleId, enabled)
    setToggling(null)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteSchedule(deleteId)
    setDeleteId(null)
  }

  const formatCron = (expression: string): string => {
    try {
      return cronstrue.toString(expression)
    } catch {
      return expression
    }
  }

  return (
    <>
      <div className="space-y-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    schedule.is_enabled
                      ? "bg-green-100 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{schedule.name}</h3>
                    <Badge variant={schedule.is_enabled ? "success" : "secondary"}>
                      {schedule.is_enabled ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCron(schedule.cron_expression)} ({schedule.timezone})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Environment: {schedule.environment?.name || "Unknown"}
                    {schedule.journey_ids && schedule.journey_ids.length > 0 && (
                      <> • {schedule.journey_ids.length} journeys</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {schedule.next_run_at && schedule.is_enabled && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Next run</p>
                    <p className="text-sm font-medium">
                      {new Date(schedule.next_run_at).toLocaleString()}
                    </p>
                  </div>
                )}

                <Switch
                  checked={schedule.is_enabled}
                  disabled={toggling === schedule.id}
                  onCheckedChange={(checked) =>
                    handleToggle(schedule.id, checked)
                  }
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(schedule.id)}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
