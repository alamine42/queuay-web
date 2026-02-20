import { NextResponse } from "next/server"
import { analyzeStory } from "@/lib/ai/story-analyzer"
import type { ConversationMessage } from "@/lib/ai/story-analyzer"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, previousExchanges = [] } = body as {
      description: string
      previousExchanges?: ConversationMessage[]
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      )
    }

    const result = await analyzeStory(description, previousExchanges)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Story analysis error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to analyze story", details: errorMessage },
      { status: 500 }
    )
  }
}
