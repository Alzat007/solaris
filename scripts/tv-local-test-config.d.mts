export interface LocalTestEndpoints {
  host: string;
  relayOrigin: string;
  controllerOrigin: string;
  controllerUrl: string;
}

export interface LocalTestValidationOptions {
  allowLan?: unknown;
  interfaces?: unknown;
}

export function isPrivateLanIpv4(value: unknown): value is string;
export function validateLocalTestEndpoints(
  config: unknown,
  options?: LocalTestValidationOptions,
): LocalTestEndpoints;
