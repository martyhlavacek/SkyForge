import { describe, expect, it } from 'vitest';
import {
  shouldEnableEmbeddedStudioBridge,
  shouldExposeGlobalRuntimeApi,
  shouldStartRuntimePreview,
} from './RuntimeBridgePolicy';

describe('runtime bridge production policy', () => {
  it('never exposes mutable global controls merely because studio=1 is present', () => {
    expect(shouldExposeGlobalRuntimeApi({ dev: false, e2e: false })).toBe(false);
    expect(shouldExposeGlobalRuntimeApi({ dev: true, e2e: false })).toBe(true);
    expect(shouldExposeGlobalRuntimeApi({ dev: false, e2e: true })).toBe(true);
  });

  it('requires embedding and a session nonce for the production Studio bridge', () => {
    expect(
      shouldEnableEmbeddedStudioBridge({
        studioRequested: true,
        embedded: true,
        session: 'nonce',
      }),
    ).toBe(true);
    expect(
      shouldEnableEmbeddedStudioBridge({
        studioRequested: true,
        embedded: false,
        session: 'nonce',
      }),
    ).toBe(false);
    expect(
      shouldEnableEmbeddedStudioBridge({
        studioRequested: true,
        embedded: true,
        session: null,
      }),
    ).toBe(false);
  });

  it('starts preview only in an explicitly permitted environment', () => {
    expect(
      shouldStartRuntimePreview({
        previewRequested: false,
        dev: true,
        e2e: false,
        studioBridgeEnabled: false,
      }),
    ).toBe(false);
    expect(
      shouldStartRuntimePreview({
        previewRequested: true,
        dev: false,
        e2e: false,
        studioBridgeEnabled: false,
      }),
    ).toBe(false);
    expect(
      shouldStartRuntimePreview({
        previewRequested: true,
        dev: false,
        e2e: false,
        studioBridgeEnabled: true,
      }),
    ).toBe(true);
  });
});
