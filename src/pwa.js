import { $, show, hide } from "./dom.js";

/*
 * Starts the service worker (see serviceWorker.js) on the published site, and
 * offers a reload when it has brought in a new version. Not automatic, since
 * that could happen in the middle of a roll.
 */

const toast = $("updateToast");

$("updateReloadButton").addEventListener("click", () => window.location.reload());
$("updateLaterButton").addEventListener("click", () => hide(toast));

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    // On the very first visit it takes over too, but there's nothing newer to reload for
    const updating = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (updating) {
            show(toast);
        }
    });

    window.addEventListener("load", () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => {
            console.error("Failed to start the service worker:", error);
        });
    });
}
