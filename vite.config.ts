import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

const pages = ['index', 'icon', 'blocks', 'features'];
for (const name of fs.readdirSync(resolve(__dirname, 'src/features'))) {
  if (name.endsWith('.html')) pages.push(`features/${name.slice(0, -5)}`);
}

export default defineConfig({
  root: './src',
  build: {
    outDir: '../dist',
    minify: false,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map(page => [page, resolve(__dirname, `src/${page}.html`)]))
    }
  },
  plugins: [{
    name: 'copy-upstream-assets',
    writeBundle() {
      // Classic upstream scripts share globals and must retain their load order.
      for (const name of ['manifest.json', 'favicon.ico']) {
        fs.copyFileSync(resolve(__dirname, 'src', name), resolve(__dirname, 'dist', name));
      }
      fs.cpSync(resolve(__dirname, 'src/js-editor'), resolve(__dirname, 'dist/js-editor'), { recursive: true });
      fs.cpSync(resolve(__dirname, 'src/features'), resolve(__dirname, 'dist/features'), {
        recursive: true,
        filter: path => !path.endsWith('.html')
      });
    }
  }]
});
