import { spawnSync } from "node:child_process"
import { createSerwistRoute } from "@serwist/turbopack"

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim() ||
  "development"

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { url: "/~offline", revision },
      { url: "/icons/icon-192.png", revision },
      { url: "/icons/icon-512.png", revision },
    ],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  })
