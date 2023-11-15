import wasmPackPlugin from "@wasm-tool/wasm-pack-plugin";
import path from "path";
import type webpack from "webpack";

export default (env: any): webpack.Configuration => ({
    entry: "./src/Runtime/Optimized/wasm/index.js",
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist/umd"),
        filename: `babylon.mmd.wasm${env.production ? ".min" : ""}.js`,
        library: {
            name: {
                amd: "babylon-mmd-wasm",
                commonjs: "babylon-mmd-wasm",
                root: "BABYLONMMDWASM"
            },
            type: "umd"
        },
        // libraryExport: "default",
        umdNamedDefine: true,
        globalObject: "(typeof self !== \"undefined\" ? self : typeof global !== \"undefined\" ? global : this)"
    },
    optimization: {
        minimize: env.production
    },
    module: {
        rules: [{ test: /\.tsx?$/, loader: "ts-loader" }]
    },
    resolve: {
        modules: ["src/Runtime/Optimized/wasm", "node_modules"],
        extensions: [".js", ".jsx", ".ts", ".tsx"]
    },
    plugins: [
        new wasmPackPlugin({
            crateDirectory: path.resolve(__dirname, "src/Runtime/Optimized/wasm_src"),
            outDir: path.resolve(__dirname, "src/Runtime/Optimized/wasm"),
            outName: "index"
        })
    ],
    mode: env.production ? "production" : "development",
    experiments: {
        asyncWebAssembly: true
    }
});
