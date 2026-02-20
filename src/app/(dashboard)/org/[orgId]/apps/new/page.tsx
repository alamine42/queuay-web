"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createApp } from "@/app/actions/apps"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react"

export default function NewAppPage() {
  const params = useParams()
  const orgId = params.orgId as string
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("orgId", orgId)

    const result = await createApp(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/org/${orgId}/apps`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Apps
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create a new app</CardTitle>
          <CardDescription>
            Add an application to start creating test journeys
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
              <Label htmlFor="name">App Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="My Application"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="A brief description of your application"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                name="baseUrl"
                type="url"
                placeholder="https://example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                The URL of your application&apos;s production environment
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Link href={`/org/${orgId}/apps`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create App"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
