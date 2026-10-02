import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('blockchain-writer ethers caching', () => {
  it('uses a module-level provider/signer cache instead of per-job creation', () => {
    const source = readFileSync(
      new URL('../src/blockchain-writer.js', import.meta.url),
      'utf-8'
    );
    // Should have a cached provider pattern
    expect(source).toContain('cachedProvider');
    expect(source).toContain('cachedSigner');
    // Should NOT call buildProvider() inside writeHashToBlockchain
    const fnBody = source.slice(source.indexOf('export async function writeHashToBlockchain'));
    expect(fnBody).not.toMatch(/const provider = buildProvider\(\)/);
    expect(fnBody).not.toMatch(/const signer = buildSigner\(provider\)/);
  });
});
