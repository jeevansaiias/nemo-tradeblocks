"use client"

import { useTheme } from "next-themes"
import { IconMoonStars, IconSun } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <IconSun className="size-5" />
      ) : (
        <IconMoonStars className="size-5" />
      )}
    </Button>
  )
}
