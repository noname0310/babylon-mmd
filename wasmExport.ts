import { WasmModuleExport } from "./webpack.config";

new WasmModuleExport(process.argv[2]).updateCode();
