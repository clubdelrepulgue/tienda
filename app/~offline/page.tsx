import Link from "next/link"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-secondary p-6 text-center">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        <WifiOff className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Estás sin conexión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Podés volver al último menú que visitaste o intentar nuevamente cuando tengas internet.
        </p>
        <Button asChild className="mt-6 w-full rounded-full">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </section>
    </main>
  )
}
