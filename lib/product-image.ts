export const DEFAULT_PRODUCT_IMAGE = "/assets/SIN IMG.webp"

export function getProductImage(images?: string[] | null, legacyImage?: string | null) {
  const validImages = (images || []).filter(Boolean)

  return validImages[0] || legacyImage || DEFAULT_PRODUCT_IMAGE
}
