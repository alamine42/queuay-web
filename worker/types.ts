// Worker-specific types

export interface TestRunJobData {
  testRunId: string
  organizationId: string
  appId: string
  environmentId: string
  storyIds?: string[]
  journeyIds?: string[]
}

export interface StoryStep {
  action: string
  element?: string
  value?: string
  description?: string
  selector?: string
}

export interface StoryOutcome {
  description: string
  verifications: StoryVerification[]
}

export interface StoryVerification {
  type: 'visual' | 'element' | 'url' | 'content'
  target?: string
  expected: string
}

export interface StepResult {
  step: number
  action: string
  passed: boolean
  duration_ms: number
  error?: string
  screenshot?: string
}

export interface StoryExecutionResult {
  passed: boolean
  duration_ms: number
  steps: StepResult[]
  error?: string
  screenshot_url?: string
  console_errors?: string[]
  heal_proposal?: HealProposal
  retries: number
}

export interface HealProposal {
  type: 'selector' | 'flow' | 'content'
  original: string
  proposed: string
  file?: string
  line?: number
  confidence: number
  reasoning: string
}
