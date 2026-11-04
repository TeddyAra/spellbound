/*
 * Keeps a copy of the site in the browser, so it opens without an internet
 * connection and straight away on a slow one. Not part of the page's code:
 * vite.config.js fills in the two values below and writes this to sw.js when
 * the site is built. Nothing runs during development.
 *
 * A new build changes VERSION, which makes the browser fetch all of it again
 * in the background and swap it in. The page then offers a reload (see pwa.js).
 * The characters aren't stored here, so updates don't touch them.
 */

// The site's files, and a fingerprint of them
const FILES = "__FILES__";
const VERSION = "__VERSION__";

const PREFIX = "spellbound-";
const SITE_CACHE = `${PREFIX}site-${VERSION}`;

// The themes' fonts, kept once they've been downloaded. They don't change with the site.
const FONT_CACHE = `${PREFIX}fonts`;

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(SITE_CACHE)
            .then(cache => cache.addAll(FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith(PREFIX) && key !== SITE_CACHE && key !== FONT_CACHE)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

async function font(request) {
    const cache = await caches.open(FONT_CACHE);
    const saved = await cache.match(request);

    if (saved) {
        return saved;
    }

    const response = await fetch(request);

    // A failed download isn't kept, or it would be served from then on
    if (response.ok) {
        await cache.put(request, response.clone());
    }

    return response;
}

async function siteFile(request) {
    const cache = await caches.open(SITE_CACHE);

    // Every page of the site is the one page. Going by the address alone is safe, since the built
    // files' names change with their contents, and a server's Vary header could otherwise hide them.
    const saved = request.mode === "navigate"
        ? await cache.match(new URL("index.html", self.registration.scope))
        : await cache.match(request, { ignoreVary: true });

    return saved ?? fetch(request);
}

self.addEventListener("fetch", event => {
    const { request } = event;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (FONT_HOSTS.includes(url.hostname)) {
        event.respondWith(font(request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(siteFile(request));
    }
});
