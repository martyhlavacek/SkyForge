export interface RuntimeExposureContext {
  dev: boolean;
  e2e: boolean;
}

export interface EmbeddedStudioContext {
  studioRequested: boolean;
  embedded: boolean;
  session: string | null;
}

/** Mutable runtime controls are global only in explicit development/E2E builds. */
export function shouldExposeGlobalRuntimeApi(context: RuntimeExposureContext): boolean {
  return context.dev || context.e2e;
}

/** Production Studio control requires an embedded same-origin frame and a session nonce. */
export function shouldEnableEmbeddedStudioBridge(
  context: EmbeddedStudioContext,
): boolean {
  return context.studioRequested && context.embedded && Boolean(context.session);
}
