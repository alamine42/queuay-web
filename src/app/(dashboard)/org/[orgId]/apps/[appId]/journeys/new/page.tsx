"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createJourney } from "@/app/actions/journeys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react"

export default function NewJourneyPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const appId = params.appId as string

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("appId", appId)

    const result = await createJourney(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result?.data) {
      router.push(`/org/${orgId}/apps/${appId}/journeys/${result.data.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/org/${orgId}/apps/${appId}/journeys`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Journeys
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create a new journey</CardTitle>
          <CardDescription>
            A journey groups related test stories together
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Journey Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="User Authentication"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Tests related to user login, signup, and password reset"
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Link href={`/org/${orgId}/apps/${appId}/journeys`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Journey"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
