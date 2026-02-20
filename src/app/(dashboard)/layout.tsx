import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from("organization_members")
    .select(`
      role,
      organization:organizations (
        id,
        name,
        slug,
        plan
      )
    `)
    .eq("user_id", user.id)

  const organizations = memberships?.map((m) => {
    const org = m.organization as unknown as {
      id: string
      name: string
      slug: string
      plan: string
    }
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      role: m.role as string,
    }
  }) || []

  return (
    <div className="flex h-screen">
      <Sidebar organizations={organizations} user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
