import { getOrderByToken } from "@/lib/supabase/queries"
import { notFound } from "next/navigation"
import { OrderTracker } from "./order-tracker"

interface OrderPageProps {
    params: Promise<{ token: string }>
}

export default async function OrderPage({ params }: OrderPageProps) {
    const { token } = await params
    const order = await getOrderByToken(token).catch(() => null)

    if (!order) {
        notFound()
    }

    return <OrderTracker initialOrder={order} token={token} />
}
