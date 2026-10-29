import Image from "next/image"
import { Construction } from "lucide-react"

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950"
      >
        <Construction className="h-4 w-4" />
        Desarrollo en pausa
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <Image
          src="/assets/brand/logo.jpeg"
          alt="El Club del Repulgue"
          width={160}
          height={160}
          className="rounded-full"
          priority
        />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Desarrollo en pausa
        </h1>
        <p className="max-w-md text-muted-foreground">
          Por el momento este sitio no está disponible para pedidos.
        </p>
      </div>
    </main>
  )
}
