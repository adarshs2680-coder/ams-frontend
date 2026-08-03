"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useState } from "react"

import { Button } from "../ui/button"

/**
 * Adapted from Skiper UI's "Skiper 26" theme toggle
 * (https://github.com/rudrodip/theme-toggle-effect), trimmed to the single
 * circle-reveal variant this app uses. Uses the View Transitions API with
 * self-authored CSS keyframes, so there's no third-party positioning code
 * in the mix. The reveal originates from the exact (x, y) passed to
 * toggleTheme rather than a fixed viewport position, so it always starts at
 * whatever triggered it.
 */

const STYLE_ID = "theme-transition-styles"

// Percentages resolve in logical/layout space rather than the physical-pixel
// path absolute px values go through, which avoids a known Chromium
// rasterization mismatch where clip-path circles on view-transition
// pseudo-elements drift off their given px coordinates on non-integer OS
// display scale factors (e.g. Windows 125%/150% scaling).
const createThemeTransitionCSS = (xPercent: number, yPercent: number) => `
    ::view-transition-group(root) {
        animation-duration: 0.7s;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }

    ::view-transition-old(root) {
        animation: none;
        z-index: -1;
    }

    ::view-transition-new(root) {
        animation-name: reveal-theme;
    }

    @keyframes reveal-theme {
        from {
            clip-path: circle(0% at ${xPercent}% ${yPercent}%);
        }
        to {
            clip-path: circle(150% at ${xPercent}% ${yPercent}%);
        }
    }
`

function useThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        setIsDark(resolvedTheme === "dark")
    }, [resolvedTheme])

    const toggleTheme = useCallback((x: number, y: number) => {
        const nextIsDark = !isDark
        setIsDark(nextIsDark)

        if (typeof window === "undefined") return

        const switchTheme = () => setTheme(nextIsDark ? "dark" : "light")

        if (
            !document.startViewTransition ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            switchTheme()
            return
        }

        const xPercent = (x / window.innerWidth) * 100
        const yPercent = (y / window.innerHeight) * 100

        let styleElement = document.getElementById(STYLE_ID) as HTMLStyleElement | null
        if (!styleElement) {
            styleElement = document.createElement("style")
            styleElement.id = STYLE_ID
            document.head.appendChild(styleElement)
        }
        styleElement.textContent = createThemeTransitionCSS(xPercent, yPercent)

        document.startViewTransition(switchTheme)
    }, [isDark, setTheme])

    return { toggleTheme }
}

export function ThemeToggle() {
    const { toggleTheme } = useThemeToggle()

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = event.clientX || rect.left + rect.width / 2
        const y = event.clientY || rect.top + rect.height / 2
        toggleTheme(x, y)
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={handleClick}
        >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
