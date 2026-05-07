/**
 * If value of number is not in format of array, it will be treated as String.
 */
export type CanConvertToBuffer = string | number | object | Uint8Array | Buffer;

export interface BufferGeneratorConfig {
  source?: 'number' | 'word' | CanConvertToBuffer;
  /** use the same char as content per geenrate */
  sameItemPerGenerate?: boolean;
  /** full chunk data to target size by existing data */
  chunkSize?: number;
  // count?: number;
  /** how many chunk can be genereated by calling function generator */
  generateCount?: number;
}

export type ConvertBufferToType = 'json' | 'string' | 'buffer' | 'number';
export type CanTransfromBetweenBuffer = CanConvertToBuffer;
// export type DataTypeFromBuffer = string | number | object | Uint8Array; //Buffer | string | object | null;
