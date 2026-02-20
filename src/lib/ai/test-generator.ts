import { chat } from "./story-analyzer"
import type { Story } from "@/lib/types"

const TEST_GENERATION_PROMPT = `You are an expert Playwright test writer. Generate a complete, runnable Playwright test file based on the story provided.

Follow these guidelines:
1. Use modern Playwright APIs (Playwright Test)
2. Use role-based and text-based selectors when possible
3. Add proper waits and assertions
4. Handle potential race conditions
5. Include setup/teardown if needed
6. Use test.describe for grouping
7. Use test.beforeEach for common setup

Generate ONLY the TypeScript code, no explanations. The code should be complete and runnable.

The test should:
- Import from '@playwright/test'
- Use test() and expect() from Playwright
- Navigate to the baseUrl
- Execute all steps in order
- Verify the expected outcome`

export async function generateTestCode(
  story: Story,
  baseUrl: string
): Promise<string> {
  const storyDescription = `
Story: ${story.title}
Name: ${story.name}

Preconditions:
${story.preconditions?.map((p) => `- ${p.description} (${p.type})`).join("\n") || "None"}

Steps:
${story.steps
  .map(
    (s, i) =>
      `${i + 1}. Action: ${s.action}${s.element ? ` on "${s.element}"` : ""}${s.value ? ` with value "${s.value}"` : ""}`
  )
  .join("\n")}

Expected Outcome:
${story.outcome.description}

Verifications:
${story.outcome.verifications
  .map((v) => `- ${v.type}: ${v.expected}${v.target ? ` (target: ${v.target})` : ""}`)
  .join("\n")}
`

  const response = await chat(
    [
      {
        role: "user",
        content: `Generate a Playwright test for this story:

${storyDescription}

Base URL: ${baseUrl}

Generate a complete .spec.ts file with proper imports and structure.`,
      },
    ],
    TEST_GENERATION_PROMPT
  )

  // Extract code from markdown if present
  const codeMatch = response.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/)
  return codeMatch ? codeMatch[1].trim() : response.trim()
}

export async function regenerateTestCode(
  story: Story,
  baseUrl: string,
  previousError?: string
): Promise<string> {
  const storyDescription = `
Story: ${story.title}
Name: ${story.name}

Preconditions:
${story.preconditions?.map((p) => `- ${p.description} (${p.type})`).join("\n") || "None"}

Steps:
${story.steps
  .map(
    (s, i) =>
      `${i + 1}. Action: ${s.action}${s.element ? ` on "${s.element}"` : ""}${s.value ? ` with value "${s.value}"` : ""}`
  )
  .join("\n")}

Expected Outcome:
${story.outcome.description}

Verifications:
${story.outcome.verifications
  .map((v) => `- ${v.type}: ${v.expected}${v.target ? ` (target: ${v.target})` : ""}`)
  .join("\n")}
`

  const errorContext = previousError
    ? `\n\nThe previous test failed with this error:\n${previousError}\n\nPlease fix the test to address this issue.`
    : ""

  const response = await chat(
    [
      {
        role: "user",
        content: `Regenerate a Playwright test for this story:

${storyDescription}

Base URL: ${baseUrl}${errorContext}

Generate a complete .spec.ts file with proper imports and structure.`,
      },
    ],
    TEST_GENERATION_PROMPT
  )

  // Extract code from markdown if present
  const codeMatch = response.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/)
  return codeMatch ? codeMatch[1].trim() : response.trim()
}
