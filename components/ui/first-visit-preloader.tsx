'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { GooeyText } from '@/components/ui/gooey-text-morphing'
import {
  FIRST_VISIT_PRELOADER_COOLDOWN_TIME,
  FIRST_VISIT_PRELOADER_DURATION_MS,
  FIRST_VISIT_PRELOADER_MORPH_TIME,
  FIRST_VISIT_PRELOADER_STORAGE_KEY,
  FIRST_VISIT_PRELOADER_TEXTS,
  shouldRunFirstVisitPreloader,
} from '@/lib/preloader'
import { cn } from '@/lib/utils'

type PreloaderPhase = 'hidden' | 'visible' | 'closing'

function setPreloaderState(state: 'pending' | 'seen') {
  document.documentElement.dataset.blazrPreloaderState = state
}

function markPreloaderAsSeen() {
  try {
    window.localStorage.setItem(FIRST_VISIT_PRELOADER_STORAGE_KEY, '1')
  } catch {}

  setPreloaderState('seen')
}

export function FirstVisitPreloader() {
  const pathname = usePathname()
  const [phase, setPhase] = React.useState<PreloaderPhase>('hidden')
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => {
      mediaQuery.removeEventListener('change', updatePreference)
    }
  }, [])

  React.useEffect(() => {
    if (!shouldRunFirstVisitPreloader(pathname)) {
      setPhase('hidden')
      setPreloaderState('seen')
      return
    }

    let alreadySeen = false

    try {
      alreadySeen = window.localStorage.getItem(FIRST_VISIT_PRELOADER_STORAGE_KEY) === '1'
    } catch {}

    if (alreadySeen) {
      setPhase('hidden')
      setPreloaderState('seen')
      return
    }

    setPhase('visible')
    setPreloaderState('pending')

    const displayDuration = prefersReducedMotion ? 900 : FIRST_VISIT_PRELOADER_DURATION_MS
    const closeTimer = window.setTimeout(() => {
      markPreloaderAsSeen()
      setPhase('closing')
    }, displayDuration)

    const cleanupTimer = window.setTimeout(
      () => {
        setPhase('hidden')
      },
      displayDuration + 320,
    )

    return () => {
      window.clearTimeout(closeTimer)
      window.clearTimeout(cleanupTimer)
    }
  }, [pathname, prefersReducedMotion])

  if (phase === 'hidden') {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-background px-6 transition-opacity duration-500',
        phase === 'closing' && 'opacity-0',
      )}
    >
      <div className="flex min-h-[10rem] w-full max-w-6xl items-center justify-center text-center">
        {prefersReducedMotion ? (
          <p className="max-w-5xl px-4 font-heading text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-[82px]">
            Todo en un solo lugar
          </p>
        ) : (
          <GooeyText
            texts={FIRST_VISIT_PRELOADER_TEXTS}
            morphTime={FIRST_VISIT_PRELOADER_MORPH_TIME}
            cooldownTime={FIRST_VISIT_PRELOADER_COOLDOWN_TIME}
            className="h-28 w-full font-heading font-semibold sm:h-36 md:h-44"
            textClassName="px-4 text-4xl font-semibold leading-none tracking-tight text-white sm:text-6xl md:text-[82px]"
          />
        )}
      </div>
    </div>
  )
}
