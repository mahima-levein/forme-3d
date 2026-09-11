// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { execFile } from 'node:child_process';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [tailwindcss(), {
			name: 'customizer-catalog-watcher',
			configureServer(server) {
				let timer;
				const regenerate = (file) => {
					if (!file.replaceAll('\\\\', '/').includes('/src/assets/') && !file.endsWith('product-overrides.json')) return;
					clearTimeout(timer);
					timer = setTimeout(() => execFile(process.execPath, ['scripts/generate-customizer-catalog.mjs'], { cwd: process.cwd() }, (error) => {
						if (error) server.config.logger.error(`Customizer catalogue generation failed: ${error.message}`);
						else server.ws.send({ type: 'full-reload' });
					}), 120);
				};
				server.watcher.on('add', regenerate).on('change', regenerate).on('unlink', regenerate);
			}
		}]
	},
	integrations: [react()]
});
