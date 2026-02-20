"use client"

import { useState } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDuration } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertTriangle,
  Wrench,
} from "lucide-react"
import type { TestResult, StepResult, HealProposal } from "@/lib/types"

interface ResultsListProps {
  results: (TestResult & { story?: { title: string; journey_id: string } })[]
  orgId: string
  appId: string
  runId: string
  isInProgress?: boolean
}

export function ResultsList({
  results,
  orgId,
  appId,
  runId,
  isInProgress,
}: ResultsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "passed" | "failed">("all")

  const filteredResults = results.filter((r) => {
    if (filter === "all") return true
    if (filter === "passed") return r.passed
    if (filter === "failed") return !r.passed
    return true
  })

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        {isInProgress ? (
          <>
            <Clock className="h-12 w-12 mx-auto text-blue-500 animate-pulse mb-4" />
            <p className="text-muted-foreground">
              Waiting for test results...
            </p>
          </>
        ) : (
          <>
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No results yet</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({results.length})
        </Button>
        <Button
          variant={filter === "passed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("passed")}
          className={filter === "passed" ? "" : "text-green-600"}
        >
          Passed ({results.filter((r) => r.passed).length})
        </Button>
        <Button
          variant={filter === "failed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("failed")}
          className={filter === "failed" ? "" : "text-red-600"}
        >
          Failed ({results.filter((r) => !r.passed).length})
        </Button>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {filteredResults.map((result) => (
          <div
            key={result.id}
            className="border rounded-lg overflow-hidden"
          >
            {/* Result Header */}
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              onClick={() =>
                setExpandedId(expandedId === result.id ? null : result.id)
              }
            >
              <div className="flex items-center gap-3">
                {result.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="text-left">
                  <p className="font-medium">
                    {result.story?.title || result.story_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.journey_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {result.heal_proposal && (
                  <Badge variant="warning" className="gap-1">
                    <Wrench className="h-3 w-3" />
                    Heal Available
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDuration(result.duration_ms)}
                </span>
                {result.retries > 0 && (
                  <Badge variant="secondary">{result.retries} retries</Badge>
                )}
                {expandedId === result.id ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded Details */}
            {expandedId === result.id && (
              <div className="border-t px-4 py-4 bg-muted/30">
                <Tabs defaultValue="steps">
                  <TabsList>
                    <TabsTrigger value="steps">Steps</TabsTrigger>
                    {result.error && (
                      <TabsTrigger value="error">Error</TabsTrigger>
                    )}
                    {result.screenshot_url && (
                      <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
                    )}
                    {result.console_errors && result.console_errors.length > 0 && (
                      <TabsTrigger value="console">
                        Console ({result.console_errors.length})
                      </TabsTrigger>
                    )}
                    {result.heal_proposal && (
                      <TabsTrigger value="heal">Heal Proposal</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="steps" className="mt-4">
                    <StepTimeline steps={result.steps || []} />
                  </TabsContent>

                  {result.error && (
                    <TabsContent value="error" className="mt-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">
                          {result.error}
                        </pre>
                      </div>
                    </TabsContent>
                  )}

                  {result.screenshot_url && (
                    <TabsContent value="screenshot" className="mt-4">
                      <div className="border rounded-lg overflow-hidden">
                        <Image
                          src={result.screenshot_url}
                          alt="Test screenshot"
                          width={1280}
                          height={720}
                          className="w-full"
                        />
                      </div>
                    </TabsContent>
                  )}

                  {result.console_errors && result.console_errors.length > 0 && (
                    <TabsContent value="console" className="mt-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                        {result.console_errors.map((error, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <pre className="text-yellow-800 whitespace-pre-wrap font-mono flex-1">
                              {error}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  {result.heal_proposal && (
                    <TabsContent value="heal" className="mt-4">
                      <HealProposalView proposal={result.heal_proposal} />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTimeline({ steps }: { steps: StepResult[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No step data available</p>
    )
  }

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            step.passed
              ? "border-green-200 bg-green-50/50"
              : "border-red-200 bg-red-50/50"
          }`}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border">
            {step.passed ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              Step {step.step + 1}: {step.action}
            </p>
            {step.error && (
              <p className="text-sm text-red-600 mt-1">{step.error}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDuration(step.duration_ms)}
          </span>
        </div>
      ))}
    </div>
  )
}

function HealProposalView({ proposal }: { proposal: HealProposal }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Badge
            variant={
              proposal.confidence >= 0.8
                ? "success"
                : proposal.confidence >= 0.5
                ? "warning"
                : "secondary"
            }
          >
            {Math.round(proposal.confidence * 100)}% confidence
          </Badge>
          <Badge variant="outline" className="ml-2">
            {proposal.type}
          </Badge>
        </div>
      </div>

      <p className="text-sm">{proposal.reasoning}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium mb-2 text-red-600">Original</p>
          <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm font-mono overflow-x-auto">
            {proposal.original}
          </pre>
        </div>
        <div>
          <p className="text-sm font-medium mb-2 text-green-600">Proposed Fix</p>
          <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm font-mono overflow-x-auto">
            {proposal.proposed}
          </pre>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="default" size="sm">
          Apply Fix
        </Button>
        <Button variant="outline" size="sm">
          Dismiss
        </Button>
      </div>
    </div>
  )
}
