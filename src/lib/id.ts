import { uuidv7 } from 'uuidv7';

/** Client-generated UUID v7 for every new row (doc 05 §1), so records can be created offline. */
export const newId = (): string => uuidv7();
