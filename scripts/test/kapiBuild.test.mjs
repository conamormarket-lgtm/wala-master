import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pluginNames = config => config.plugins.flat(Infinity).filter(Boolean).map(plugin => plugin.name);

test('Vercel build config loads without the excluded functions folder or the local Kapi backend', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'wala-kapi-build-'));
  const dependencies = path.join(fixture, 'node_modules');
  const previousVercel = process.env.VERCEL;
  try {
    for (const file of ['vite.config.js', 'package.json', 'scripts/storefront-bootstrap.mjs', 'src/observability/firestore-byte-meter.mjs']) {
      await fs.mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
      await fs.copyFile(path.join(root, file), path.join(fixture, file));
    }
    await fs.symlink(path.join(root, 'node_modules'), dependencies, process.platform === 'win32' ? 'junction' : 'dir');
    process.env.VERCEL = '1';
    for (const mode of ['production', 'preview']) {
      const loaded = await loadConfigFromFile({ command: 'build', mode }, path.join(fixture, 'vite.config.js'), fixture);
      assert.ok(loaded);
      assert.ok(!pluginNames(loaded.config).includes('kapi-private-local-api'));
      assert.ok(loaded.dependencies.every(file => !/[/\\](functions|kapi-local)[/\\]/.test(file)));
    }
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    // Unlink the dependency junction first; never recurse into shared modules.
    await fs.unlink(dependencies).catch(error => { if (error.code !== 'ENOENT') throw error; });
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('wala-kapi-build-'));
    await fs.rm(fixture, { recursive: true, force: true });
  }
});

test('local development still loads the Kapi API plugin', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, path.join(root, 'vite.config.js'), root);
  assert.ok(pluginNames(loaded.config).includes('kapi-private-local-api'));
});
