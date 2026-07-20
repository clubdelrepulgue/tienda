/// <reference lib="esnext" />
/// <reference lib="webworker" />

import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist"
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const DAY = 24 * 60 * 60
const publicPage = (pathname: string) =>
  pathname === "/" ||
  pathname === "/checkout" ||
  pathname === "/driver/dashboard" ||
  pathname === "/~offline" ||
  pathname.startsWith("/menu/")

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url: { pathname } }) =>
      sameOrigin && pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "repulgue-static-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * DAY })],
    }),
  },
  {
    matcher: ({ request, url }) =>
      request.destination === "image" &&
      !url.hostname.includes("googleapis.com") &&
      !url.hostname.includes("google.com"),
    handler: new CacheFirst({
      cacheName: "repulgue-images-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 160, maxAgeSeconds: 30 * DAY })],
    }),
  },
  {
    matcher: ({ sameOrigin, url: { pathname } }) =>
      sameOrigin && pathname.startsWith("/api/"),
    method: "GET",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin && request.headers.get("RSC") === "1" && publicPage(pathname),
    handler: new NetworkFirst({
      cacheName: "repulgue-rsc-v1",
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 24, maxAgeSeconds: DAY })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin && request.mode === "navigate" && publicPage(pathname),
    handler: new NetworkFirst({
      cacheName: "repulgue-pages-v1",
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 24, maxAgeSeconds: DAY })],
    }),
  },
  {
    matcher: ({ sameOrigin }) => sameOrigin,
    handler: new NetworkOnly(),
  },
  {
    matcher: /.*/,
    handler: new NetworkOnly(),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()
