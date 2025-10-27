export type CoerceFunc = (type: string, value: unknown) => unknown;

export class AbiCoder {
  readonly coerceFunc: CoerceFunc | null;
  constructor(coerceFunc?: CoerceFunc | null);
  encode(types: ReadonlyArray<string>, values: ReadonlyArray<unknown>): string;
  decode(types: ReadonlyArray<string>, data: unknown, loose?: boolean): unknown;
  getDefaultValue(types: ReadonlyArray<string>): unknown;
}

export const defaultAbiCoder: AbiCoder;
