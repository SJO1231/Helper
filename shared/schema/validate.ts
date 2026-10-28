import Ajv2020 from 'ajv/dist/2020.js';
import captureRequest from './capture-request.schema.json';
import captureResult from './capture-result.schema.json';
import dictScreen from './dict-screen.schema.json';
import nativeMessage from './native-message.schema.json';
import recordsPage from './records-page.schema.json';
import seed from './seed.schema.json';

export type SchemaName = 'capture-request' | 'capture-result' | 'records-page' | 'dict-screen' | 'native-message';
export type SeedTable = 'dict_key' | 'dict_alias' | 'dict_label' | 'dict_code' | 'dict_screen' | 'dict_child';

// dict-screen is registered before seed because seed's dict_screen rows point at it.
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const schema of [captureRequest, captureResult, dictScreen, nativeMessage, recordsPage, seed]) {
  ajv.addSchema(schema);
}

export function validate(name: SchemaName, data: unknown): boolean {
  return ajv.getSchema(name)!(data) === true;
}

export function validateSeedFile(table: SeedTable, data: unknown): boolean {
  return ajv.getSchema(`seed#/$defs/file_${table}`)!(data) === true;
}
