import Image from "next/image"
import Link from "next/link"

// Cache the rendered page and refresh it in background at most every 60s
export const revalidate = 60
import { ArrowRight, ShoppingBag } from "lucide-react"
import { getBranches } from "@/lib/supabase/queries"
import type { Branch } from "@/lib/types"

const branchArtwork: Record<string, string> = {
  burger: "/assets/BURGER LAND.webp",
  "burger-land": "/assets/BURGER LAND.webp",
  burgerland: "/assets/BURGER LAND.webp",
  burguer: "/assets/BURGER LAND.webp",
  pizza: "/assets/TAPA PIZZA LAB.webp",
  "pizza-lab": "/assets/TAPA PIZZA LAB.webp",
  lab2: "/assets/TAPA PIZZA LAB.webp",
  lab: "/assets/TAPA PIZZA LAB.webp",
  repulgue: "/assets/TAPA PIZZA LAB.webp",
}

function getBranchArtwork(branch: Branch) {
  const normalized = `${branch.slug} ${branch.name}`.toLowerCase()
  const match = Object.entries(branchArtwork).find(([key]) => normalized.includes(key))

  return match?.[1] || branch.bannerUrl || branch.logoUrl || "/assets/brand/logo.jpeg"
}

function getBranchPriority(branch: Branch) {
  const normalized = `${branch.slug} ${branch.name}`.toLowerCase()

  if (normalized.includes("burger") || normalized.includes("burguer")) return 0
  if (normalized.includes("pizza") || normalized.includes("lab") || normalized.includes("repulgue")) return 1

  return 2
}

export default async function BranchSelectorPage() {
  const branches = (await getBranches())
    .filter((branch) => branch.isOpen)
    .sort((a, b) => getBranchPriority(a) - getBranchPriority(b))
  const banners = branches.filter((branch) => branch.bannerUrl)

  return (
    <main className="flex min-h-dvh items-start bg-[#F3F3F3] px-4 py-5 text-[#555] sm:px-6 sm:py-7">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        {banners.length > 0 && (
          <div className="relative aspect-[2.83/1] overflow-hidden rounded-2xl bg-white sm:rounded-3xl">
            {banners.map((branch) => (
              <Link
                key={branch.id}
                href={`/menu/${branch.slug}`}
                aria-label={`Ver menú de ${branch.name}`}
                className={`${banners.length > 1 ? "home-banner-slide" : ""} absolute inset-0 block outline-none ring-offset-4 ring-offset-[#F3F3F3] transition duration-300 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-[#5B5759]`}
              >
                <Image
                  src={branch.bannerUrl}
                  alt={branch.name}
                  fill
                  sizes="(min-width: 1200px) 1152px, calc(100vw - 2rem)"
                  quality={100}
                  priority
                  className="object-cover"
                />
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center px-1 text-center sm:justify-start sm:text-left">
          <h1
            className="flex w-full items-center justify-center gap-2 text-[1.42rem] font-semibold leading-none tracking-normal text-[#1D1D1F] sm:justify-start sm:gap-3 sm:text-3xl sm:leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="whitespace-nowrap">Elegí dónde querés pedir</span>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 rotate-90 rounded-full bg-white/80 p-0.5 text-[#6E6E73] shadow-[0_4px_14px_rgba(20,20,20,0.08)] sm:h-7 sm:w-7 sm:rotate-0 sm:bg-transparent sm:p-0 sm:text-[#5B5759] sm:shadow-none lg:h-8 lg:w-8" aria-hidden="true" />
          </h1>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border bg-white p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
            <p className="font-semibold text-foreground">No hay sucursales abiertas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Volve a intentar mas tarde.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:gap-7">
              {branches.map((branch) => (
                <Link
                  key={branch.id}
                  href={`/menu/${branch.slug}`}
                  aria-label={`Pedir en ${branch.name}`}
                  className="home-branch-card group relative block aspect-[1.28/1] overflow-hidden rounded-[2.5rem] bg-white shadow-none outline-none ring-offset-4 ring-offset-[#F3F3F3] transition duration-300 hover:-translate-y-2 hover:shadow-[0_30px_70px_rgba(20,20,20,0.18)] focus-visible:ring-2 focus-visible:ring-[#5B5759] sm:rounded-[3.5rem] lg:rounded-[4.5rem]"
                >
                  <Image
                    src={getBranchArtwork(branch)}
                    alt={branch.name}
                    fill
                    sizes="(min-width: 1200px) 560px, (min-width: 640px) calc((100vw - 4.25rem) / 2), calc(100vw - 2rem)"
                    quality={100}
                    priority
                    className="object-cover"
                  />
                  <span className="absolute inset-0 bg-black/10 transition duration-300 group-hover:bg-black/20 group-focus-visible:bg-black/20 sm:bg-black/0" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex translate-y-0 items-center gap-2 rounded-full bg-white/92 px-6 py-3 text-sm font-bold text-[#1D1D1F] opacity-100 shadow-[0_18px_40px_rgba(20,20,20,0.18)] backdrop-blur-md transition duration-300 group-hover:bg-white group-focus-visible:bg-white sm:translate-y-4 sm:bg-white sm:text-[#4F4B4D] sm:opacity-0 sm:backdrop-blur-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100 sm:text-base">
                      Ver menu
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>

          </>
        )}
      </section>
    </main>
  )
}
