import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

/*
 * Writes the service worker (see src/serviceWorker.js) once the site is built,
 * with the list of files to keep. The names of the built files change with
 * their contents, so the list can't be written by hand.
 */
function serviceWorker() {
    let outDir;

    return {
        name: 'spellbound-service-worker',
        apply: 'build',

        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },

        closeBundle() {
            const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
                .filter(entry => entry.isFile() && entry.name !== 'sw.js')
                .map(entry => relative(outDir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
                .sort();

            const fingerprint = createHash('sha256');

            for (const file of files) {
                fingerprint.update(file).update(readFileSync(join(outDir, file)));
            }

            const source = readFileSync(resolve(import.meta.dirname, 'src/serviceWorker.js'), 'utf8')
                .replace('"__FILES__"', () => JSON.stringify(files))
                .replace('__VERSION__', () => fingerprint.digest('hex').slice(0, 12));

            writeFileSync(join(outDir, 'sw.js'), source);
        }
    };
}

export default defineConfig({
    // The GitHub Pages repository name
    base: '/spellbound/',

    plugins: [serviceWorker()],

    // npm test: a pretend browser, for the storage and events state.js uses
    test: {
        environment: 'jsdom'
    }
});
