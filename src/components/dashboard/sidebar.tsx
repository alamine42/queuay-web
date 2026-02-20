"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Box,
  Play,
  Calendar,
  Settings,
  ChevronDown,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { User } from "@supabase/supabase-js"

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  role: string
}

interface SidebarProps {
  organizations: Organization[]
  user: User
}

export function Sidebar({ organizations, user }: SidebarProps) {
  const params = useParams()
  const pathname = usePathname()
  const currentOrgId = params.orgId as string
  const currentAppId = params.appId as string

  const currentOrg = organizations.find((o) => o.id === currentOrgId)

  const navigation = currentAppId
    ? [
        {
          name: "Overview",
          href: `/org/${currentOrgId}/apps/${currentAppId}`,
          icon: LayoutDashboard,
        },
        {
          name: "Journeys",
          href: `/org/${currentOrgId}/apps/${currentAppId}/journeys`,
          icon: Box,
        },
        {
          name: "Test Runs",
          href: `/org/${currentOrgId}/apps/${currentAppId}/runs`,
          icon: Play,
        },
        {
          name: "Schedules",
          href: `/org/${currentOrgId}/apps/${currentAppId}/schedules`,
          icon: Calendar,
        },
        {
          name: "Settings",
          href: `/org/${currentOrgId}/apps/${currentAppId}/settings`,
          icon: Settings,
        },
      ]
    : [
        {
          name: "Dashboard",
          href: `/org/${currentOrgId}`,
          icon: LayoutDashboard,
        },
        {
          name: "Apps",
          href: `/org/${currentOrgId}/apps`,
          icon: Box,
        },
        {
          name: "Settings",
          href: `/org/${currentOrgId}/settings`,
          icon: Settings,
        },
      ]

  return (
    <div className="w-64 border-r bg-card flex flex-col">
      {/* Organization Switcher */}
      <div className="p-4 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between font-semibold"
            >
              <span className="truncate">{currentOrg?.name || "Select Organization"}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} asChild>
                <Link href={`/org/${org.id}`}>
                  <span className="truncate">{org.name}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === pathname ||
              (item.href !== `/org/${currentOrgId}` &&
                pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {user.email?.[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.user_metadata?.full_name || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentOrg?.plan || "Free"} plan
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
