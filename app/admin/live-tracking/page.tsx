import { redirect } from "next/navigation"

// Seguimiento se fusionó con Despacho en una sola vista.
export default function LiveTrackingPage() {
    redirect("/admin/dispatch")
}
