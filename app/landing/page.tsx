import Link from 'next/link'
import { ArrowRight, Store } from 'lucide-react'

import { GradientBackground } from '@/components/ui/paper-design-shader-background'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen h-full w-full items-center justify-center overflow-hidden">
      <GradientBackground />
      <div className="absolute inset-0 -z-10 bg-black/20" />

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-20 text-center">
        <Badge className="mb-6 rounded-full border-white/15 bg-black/20 px-4 py-1 text-white shadow-none backdrop-blur-sm">
          BLAZR Commerce Platform
        </Badge>

        <h1 className="max-w-4xl font-heading text-5xl font-light tracking-tight text-white text-balance sm:text-6xl md:text-7xl">
          Convierte tu menú en una experiencia de pedidos más rápida, clara y lista para escalar.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
          BLZR unifica storefront, checkout y operación en una sola plataforma para marcas que
          necesitan vender mejor desde web, mobile y punto de retiro.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/menu">
              Ver menú
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-white/20 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/15 hover:text-white"
          >
            <Link href="/admin">
              Ir al admin
              <Store />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
