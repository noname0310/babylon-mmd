import wasmPackPlugin from "@wasm-tool/wasm-pack-plugin";
import compressionWebpackPlugin from "compression-webpack-plugin";
import copyWebpackPlugin from "copy-webpack-plugin";
import eslintPlugin from "eslint-webpack-plugin";
import fs from "fs";
import htmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import type ts from "typescript";
import glslMinifyTransformer from "typescript-glslminify-transformer";
import webpack from "webpack";
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

export class WasmModuleExport extends webpack.WatchIgnorePlugin implements webpack.WebpackPluginInstance {
    private static readonly _PluginName = "WasmModuleExport";
    private readonly _jsFilePath: string;
    private readonly _tsFilePath: string;

    public constructor(folderName: string) {
        const jsFilePath = path.resolve(__dirname, `src/Runtime/Optimized/${folderName}/index.js`);
        const tsFilePath = path.resolve(__dirname, `src/Runtime/Optimized/${folderName}/index.d.ts`);
        super({
            paths: [jsFilePath, tsFilePath]
        });
        this._jsFilePath = jsFilePath;
        this._tsFilePath = tsFilePath;
    }

    public override apply(compiler: webpack.Compiler): void {
        super.apply(compiler);

        compiler.hooks.compilation.tap(WasmModuleExport._PluginName, () => this.updateCode());
    }

    public updateCode(): void {
        if (fs.existsSync(this._jsFilePath)) {
            const code = fs.readFileSync(this._jsFilePath, "utf-8");
            if (code.startsWith("let wasm_bindgen;")) {
                const newCode = code.replace("let wasm_bindgen;", "export let wasm_bindgen;");
                fs.writeFileSync(this._jsFilePath, newCode, "utf-8");
            }
        }

        if (fs.existsSync(this._tsFilePath)) {
            const code = fs.readFileSync(this._tsFilePath, "utf-8");
            const newCode = code.replace(/declare/g, "export");
            fs.writeFileSync(this._tsFilePath, newCode, "utf-8");
        }
    }
}

export default (env: any): webpack.Configuration & { devServer?: WebpackDevServerConfiguration } => ({
    entry: "./src/Test/index.ts",
    output: {
        path: path.join(__dirname, "/test_dist"),
        filename: "[name].bundle.js",
        clean: true
    },
    optimization: {
        minimize: env.production
    },
    cache: true,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                options: {
                    getCustomTransformers: (program: ts.Program) => ({
                        before: [glslMinifyTransformer(program)]
                    })
                }
            },
            {
                test: /\.html$/,
                loader: "html-loader"
            }
        ]
    },
    resolve: {
        alias: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "@": path.resolve(__dirname, "src")
        },
        modules: ["src", "node_modules"],
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        fallback: {
            "url": require.resolve("url/")
        }
    },
    plugins: [
        new htmlWebpackPlugin({
            template: "./src/Test/index.html"
        }),
        new eslintPlugin({
            extensions: ["ts", "tsx"],
            fix: true,
            cache: true
        }),
        new copyWebpackPlugin({
            patterns: [
                { from: "res", to: "res" }
            ]
        }),
        new wasmPackPlugin({
            crateDirectory: path.resolve(__dirname, "src/Runtime/Optimized/wasm_src"),
            outDir: path.resolve(__dirname, "src/Runtime/Optimized/wasm"),
            outName: "index",
            extraArgs: "--target no-modules"
        }),
        new WasmModuleExport("wasm")
    ].concat(env.production ? [
        new compressionWebpackPlugin({
            test: /\.(js|bvmd|bpmx)$/i
        }) as any
    ] : []),
    devServer: {
        host: "0.0.0.0",
        port: 20310,
        allowedHosts: "all",
        client: {
            logging: "none"
        },
        hot: true,
        watchFiles: ["src/**/*"]
    },
    mode: env.production ? "production" : "development"
});
