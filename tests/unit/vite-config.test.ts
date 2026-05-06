import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('vite dev server proxy', () => {
  it('proxies debug routes to the local API service', () => {
    const serverConfig = Array.isArray(viteConfig) ? viteConfig[0].server : viteConfig.server;
    const proxy = serverConfig?.proxy as Record<string, string> | undefined;

    expect(proxy?.['/debug']).toBe('http://api:3000');
  });
});
