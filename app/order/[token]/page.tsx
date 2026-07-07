import { getOrderByToken } from "@/lib/supabase/queries"
import { getCustomerLoyalty } from "@/lib/loyalty"
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

    // The tracking token is the credential: whoever can see this order can
    // see the loyalty status of the phone that placed it.
    const loyalty = await getCustomerLoyalty(order.customerPhone)

    return <OrderTracker initialOrder={order} token={token} loyalty={loyalty} />
}
