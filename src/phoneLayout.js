/*
 * The parts of the phone layout that don't depend on the page itself (see
 * phone.js), so they can be tested.
 */

/* Which page is showing, going by how far the pages have been swiped. */
export function nearestPage(scrollLeft, pageWidth, pageCount) {
    if (pageWidth <= 0 || pageCount <= 0) {
        return 0;
    }

    return Math.min(pageCount - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));
}

/*
 * Moves a node into `target`, leaving a marker where it was. Returns a function
 * that puts it back. It's the same node, so its click handlers come along.
 */
export function relocate(node, target) {
    const marker = document.createComment(`${node.id || "moved"} goes here`);

    node.replaceWith(marker);
    target.append(node);

    return () => marker.replaceWith(node);
}
