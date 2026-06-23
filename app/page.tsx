import Image from "next/image"
import Link from "next/link"
import { MapPin, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getBranches } from "@/lib/supabase/queries"

export default async function BranchSelectorPage() {
  const branches = (await getBranches()).filter((branch) => branch.isOpen)

  return (
    <main className="min-h-dvh bg-[#F7F7F7]">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Image
            src="/assets/brand/logo.jpeg"
            alt="El Club del Repulgue"
            width={180}
            height={40}
            priority
            className="h-8 w-auto"
          />
          <Badge variant="outline" className="rounded-full bg-white">
            Multi-sucursal
          </Badge>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="max-w-2xl">
          <h1
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Elegi desde que sucursal queres pedir
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cada restaurante tiene su propio menu, cocina y mostrador.
          </p>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
            <p className="font-semibold text-foreground">No hay sucursales abiertas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Volve a intentar mas tarde.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <article
                key={branch.id}
                className="flex min-h-48 flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm"
                style={{ borderColor: branch.brandColor || undefined }}
              >
                <div>
                  <div
                    className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary"
                    style={{
                      color: branch.brandColor || undefined,
                    }}
                  >
                    {branch.logoUrl ? (
                      <Image
                        src={branch.logoUrl}
                        alt={branch.name}
                        width={96}
                        height={96}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ShoppingBag className="h-6 w-6" />
                    )}
                  </div>
                  <h2
                    className="text-xl font-bold text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {branch.name}
                  </h2>
                  {branch.address && (
                    <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{branch.address}</span>
                    </p>
                  )}
                </div>
                <Button asChild className="mt-5 rounded-xl" style={{ backgroundColor: branch.brandColor || undefined }}>
                  <Link href={`/menu/${branch.slug}`}>Ver menu</Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
