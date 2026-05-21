'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface GooeyTextProps {
  texts: string[]
  morphTime?: number
  cooldownTime?: number
  className?: string
  textClassName?: string
}

export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className,
  textClassName,
}: GooeyTextProps) {
  const filterId = React.useId()
  const text1Ref = React.useRef<HTMLSpanElement>(null)
  const text2Ref = React.useRef<HTMLSpanElement>(null)
  const frameRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const text1 = text1Ref.current
    const text2 = text2Ref.current

    if (!text1 || !text2 || texts.length === 0) {
      return
    }

    text1.textContent = texts[texts.length - 1]
    text2.textContent = texts[0]

    if (texts.length === 1) {
      text1.style.filter = ''
      text1.style.opacity = '100%'
      text2.style.filter = ''
      text2.style.opacity = '0%'
      return
    }

    let textIndex = texts.length - 1
    let lastTime = new Date()
    let morph = 0
    let cooldown = cooldownTime

    const setMorph = (fraction: number) => {
      const safeFraction = Math.max(fraction, 0.0001)
      const inverseFraction = Math.max(1 - fraction, 0.0001)

      text2.style.filter = `blur(${Math.min(8 / safeFraction - 8, 100)}px)`
      text2.style.opacity = `${Math.pow(safeFraction, 0.4) * 100}%`

      text1.style.filter = `blur(${Math.min(8 / inverseFraction - 8, 100)}px)`
      text1.style.opacity = `${Math.pow(inverseFraction, 0.4) * 100}%`
    }

    const doCooldown = () => {
      morph = 0
      text2.style.filter = ''
      text2.style.opacity = '100%'
      text1.style.filter = ''
      text1.style.opacity = '0%'
    }

    const doMorph = () => {
      morph -= cooldown
      cooldown = 0

      let fraction = morph / morphTime

      if (fraction > 1) {
        cooldown = cooldownTime
        fraction = 1
      }

      setMorph(fraction)
    }

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate)

      const newTime = new Date()
      const shouldIncrementIndex = cooldown > 0
      const delta = (newTime.getTime() - lastTime.getTime()) / 1000

      lastTime = newTime
      cooldown -= delta

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex = (textIndex + 1) % texts.length
          text1.textContent = texts[textIndex % texts.length]
          text2.textContent = texts[(textIndex + 1) % texts.length]
        }

        doMorph()
        return
      }

      doCooldown()
    }

    doCooldown()
    frameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [texts, morphTime, cooldownTime])

  return (
    <div className={cn('relative', className)}>
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <div className="flex items-center justify-center" style={{ filter: `url(#${filterId})` }}>
        <span
          ref={text1Ref}
          className={cn(
            'absolute inline-block select-none text-center text-6xl md:text-[60pt]',
            'text-foreground',
            textClassName,
          )}
        />
        <span
          ref={text2Ref}
          className={cn(
            'absolute inline-block select-none text-center text-6xl md:text-[60pt]',
            'text-foreground',
            textClassName,
          )}
        />
      </div>
    </div>
  )
}
