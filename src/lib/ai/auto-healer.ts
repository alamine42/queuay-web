import Anthropic from "@anthropic-ai/sdk"
import type { HealProposal, HealProposalType } from "@/lib/types"

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

const HEALING_PROMPT = `You are an expert at diagnosing and fixing failing Playwright tests.

Given:
1. The failing test code
2. The error message
3. The current page HTML (partial)
4. A screenshot of the current state (if provided)

Analyze the failure and propose a fix. Common issues:
- Selector changed (element structure modified)
- Timing issue (element not ready)
- Content changed (text different)
- Flow changed (navigation different)

Respond in JSON format:
{
  "type": "selector|flow|content",
  "original": "the original code that failed",
  "proposed": "the proposed fix",
  "line": line_number,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of the fix"
}`

const INSPECTION_PROMPT = `You are a visual QA inspector analyzing a screenshot of a web application.

Given an expected state description, analyze the screenshot and determine if the expectation is met.

Respond in JSON format:
{
  "passed": boolean,
  "confidence": "high|medium|low",
  "observation": "what you actually see",
  "issues": ["issue1", "issue2"] (if any)
}

Be precise and objective. If you cannot determine the state with high confidence, indicate so.`

export interface InspectionResult {
  passed: boolean
  confidence: "high" | "medium" | "low"
  observation: string
  issues?: string[]
}

export async function proposeHeal(
  failingCode: string,
  errorMessage: string,
  pageHtml: string,
  screenshotBase64?: string
): Promise<HealProposal | null> {
  const anthropic = getClient()

  const textPrompt = `Failing test code:
\`\`\`typescript
${failingCode}
\`\`\`

Error message:
${errorMessage}

Page HTML (truncated):
\`\`\`html
${pageHtml.slice(0, 5000)}
\`\`\``

  const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] =
    screenshotBase64
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: screenshotBase64,
            },
          },
          { type: "text", text: textPrompt },
        ]
      : textPrompt

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: HEALING_PROMPT,
    messages: [{ role: "user", content: userContent }],
  })

  const textContent = response.content.find((c) => c.type === "text")
  const responseText = textContent ? textContent.text : ""

  try {
    const jsonMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
      responseText.match(/```\s*([\s\S]*?)\s*```/) ||
      [null, responseText]
    const jsonStr = jsonMatch[1] || responseText
    const result = JSON.parse(jsonStr.trim())
    return {
      type: result.type as HealProposalType,
      original: result.original,
      proposed: result.proposed,
      confidence: result.confidence,
      reasoning: result.reasoning,
      line: result.line,
    }
  } catch {
    return null
  }
}

export async function inspectScreenshot(
  screenshotBase64: string,
  expectation: string,
  consoleErrors?: string[]
): Promise<InspectionResult> {
  const anthropic = getClient()

  const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: screenshotBase64,
      },
    },
    {
      type: "text",
      text: `Expected state: "${expectation}"${
        consoleErrors && consoleErrors.length > 0
          ? `\n\nConsole errors detected:\n${consoleErrors.join("\n")}`
          : ""
      }`,
    },
  ]

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: INSPECTION_PROMPT,
    messages: [{ role: "user", content: userContent }],
  })

  const textContent = response.content.find((c) => c.type === "text")
  const responseText = textContent ? textContent.text : ""

  try {
    const jsonMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
      responseText.match(/```\s*([\s\S]*?)\s*```/) ||
      [null, responseText]
    const jsonStr = jsonMatch[1] || responseText
    return JSON.parse(jsonStr.trim())
  } catch {
    return {
      passed: false,
      confidence: "low",
      observation: "Unable to analyze screenshot",
      issues: ["Failed to parse inspection result"],
    }
  }
}

export function categorizeFailure(
  errorMessage: string
): HealProposalType | null {
  const lowerError = errorMessage.toLowerCase()

  // Selector failures
  if (
    lowerError.includes("locator") ||
    lowerError.includes("selector") ||
    lowerError.includes("element") ||
    lowerError.includes("strict mode violation") ||
    lowerError.includes("waiting for")
  ) {
    return "selector"
  }

  // Flow failures
  if (
    lowerError.includes("navigation") ||
    lowerError.includes("page closed") ||
    lowerError.includes("target closed") ||
    lowerError.includes("context")
  ) {
    return "flow"
  }

  // Content failures
  if (
    lowerError.includes("assertion") ||
    lowerError.includes("expect") ||
    lowerError.includes("match") ||
    lowerError.includes("equal")
  ) {
    return "content"
  }

  return null
}

export function shouldAutoHeal(confidence: number): boolean {
  // Only auto-heal with high confidence
  return confidence >= 0.8
}
