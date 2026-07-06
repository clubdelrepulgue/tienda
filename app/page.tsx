import Image from "next/image"
import Link from "next/link"

// Cache the rendered page and refresh it in background at most every 60s
export const revalidate = 60
import { ArrowRight, Instagram, ShoppingBag } from "lucide-react"
import { getBranches } from "@/lib/supabase/queries"
import type { Branch } from "@/lib/types"

const branchArtwork: Record<string, string> = {
  burger: "/assets/BURGER LAND.webp",
  "burger-land": "/assets/BURGER LAND.webp",
  burguer: "/assets/BURGER LAND.webp",
  pizza: "/assets/TAPA PIZZA LAB.webp",
  "pizza-lab": "/assets/TAPA PIZZA LAB.webp",
}

const socialLinks = [
  {
    label: "Instagram Burger Land",
    href: "#",
    match: "burger",
  },
  {
    label: "Instagram Pizza Lab",
    href: "#",
    match: "pizza",
  },
]

function getBranchArtwork(branch: Branch) {
  const normalized = `${branch.slug} ${branch.name}`.toLowerCase()
  const match = Object.entries(branchArtwork).find(([key]) => normalized.includes(key))

  return match?.[1] || branch.bannerUrl || branch.logoUrl || "/assets/brand/logo.jpeg"
}

function getBranchPriority(branch: Branch) {
  const normalized = `${branch.slug} ${branch.name}`.toLowerCase()

  if (normalized.includes("burger") || normalized.includes("burguer")) return 0
  if (normalized.includes("pizza")) return 1

  return 2
}

export default async function BranchSelectorPage() {
  const branches = (await getBranches())
    .filter((branch) => branch.isOpen)
    .sort((a, b) => getBranchPriority(a) - getBranchPriority(b))

  return (
    <main className="flex min-h-dvh items-center bg-[#F3F3F3] px-4 py-7 text-[#555] sm:px-8 sm:py-10 lg:px-12">
      <section className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 sm:gap-6">
        <div className="flex flex-col items-center gap-2 px-1 text-center sm:grid sm:grid-cols-2 sm:items-end sm:gap-4 sm:text-left lg:px-6">
          <h1
            className="flex w-full items-center justify-center gap-2 text-[1.42rem] font-semibold leading-none tracking-normal text-[#1D1D1F] sm:justify-start sm:gap-3 sm:text-3xl sm:leading-tight lg:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="whitespace-nowrap">Elegí dónde querés pedir</span>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 rotate-90 rounded-full bg-white/80 p-0.5 text-[#6E6E73] shadow-[0_4px_14px_rgba(20,20,20,0.08)] sm:h-7 sm:w-7 sm:rotate-0 sm:bg-transparent sm:p-0 sm:text-[#5B5759] sm:shadow-none lg:h-8 lg:w-8" aria-hidden="true" />
          </h1>
          <p className="max-w-[18rem] text-[0.95rem] font-medium leading-[1.18] text-[#6E6E73] sm:max-w-none sm:text-right sm:text-base sm:leading-snug lg:text-2xl">
            Cada restaurante tiene su propio menú, cocina y mostrador.
          </p>
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
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:gap-7">
            {branches.map((branch) => (
              <Link
                key={branch.id}
                href={`/menu/${branch.slug}`}
                aria-label={`Pedir en ${branch.name}`}
                className="home-branch-card group relative block aspect-[1.28/1] overflow-hidden rounded-[2.5rem] bg-white shadow-none outline-none ring-offset-4 ring-offset-[#F3F3F3] transition duration-300 hover:-translate-y-2 hover:scale-[1.018] hover:shadow-[0_30px_70px_rgba(20,20,20,0.18)] focus-visible:ring-2 focus-visible:ring-[#5B5759] sm:rounded-[3.5rem] lg:rounded-[4.5rem]"
              >
                <Image
                  src={getBranchArtwork(branch)}
                  alt={branch.name}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  priority
                  className="object-cover blur-[1px] transition duration-500 group-hover:scale-[1.05] group-hover:blur-[2px] sm:blur-0"
                />
                <span className="absolute inset-0 bg-black/10 transition duration-300 group-hover:bg-black/20 group-focus-visible:bg-black/20 sm:bg-black/0" />
                <span className="absolute inset-0 opacity-100 backdrop-blur-[1.5px] transition duration-300 group-hover:backdrop-blur-[3px] group-focus-visible:backdrop-blur-[3px] sm:opacity-0 sm:backdrop-blur-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex translate-y-0 items-center gap-2 rounded-full bg-white/92 px-6 py-3 text-sm font-bold text-[#1D1D1F] opacity-100 shadow-[0_18px_40px_rgba(20,20,20,0.18)] backdrop-blur-md transition duration-300 group-hover:bg-white group-focus-visible:bg-white sm:translate-y-4 sm:bg-white sm:text-[#4F4B4D] sm:opacity-0 sm:backdrop-blur-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100 sm:text-base">
                    Ver menu
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        <footer className="flex flex-col items-center justify-center gap-4 pt-4 text-[#5B5759] sm:flex-row sm:justify-between lg:px-6">
          <p className="text-sm font-medium sm:text-base">
            Seguinos en nuestras redes
          </p>
          <nav aria-label="Redes sociales" className="flex items-center gap-3">
            {socialLinks.map((social) => {
              const branch =
                branches.find((item) =>
                  `${item.slug} ${item.name}`.toLowerCase().includes(social.match)
                ) || branches[0]

              return (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 text-[#5B5759] shadow-[0_10px_24px_rgba(20,20,20,0.08)] transition duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[#5B5759] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5759] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F3F3F3]"
                >
                  {branch && (
                    <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[#F3F3F3]">
                      <Image
                        src={getBranchArtwork(branch)}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </span>
                  )}
                  <Instagram className="h-5 w-5" aria-hidden="true" />
                </a>
              )
            })}
          </nav>
        </footer>
      </section>
    </main>
  )
}
