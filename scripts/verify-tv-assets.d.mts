export interface TvAssetRoots {
  distRoot?: string;
  publicRoot?: string;
}

export interface TvAssetEvidence {
  gitCommit: string | null | undefined;
  generatedFiles: number;
  publicFiles: number;
}

export interface TvAssetConfiguration {
  stageRoot: string;
  relayOrigin?: string;
  phoneUrl?: string;
}

export function tvRelayOrigin(value?: string): string;
export function tvPhoneUrl(value?: string): string;
export function tvContentSecurityPolicy(relayOrigin?: string): string;
export function createTvIndex(html: string, relayOrigin?: string): string;
export function verifyTvAssets(roots?: TvAssetRoots): Promise<TvAssetEvidence>;
export function configureTvAssets(
  configuration: TvAssetConfiguration,
): Promise<void>;
