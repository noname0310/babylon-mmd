import wasmPackPlugin from "@wasm-tool/wasm-pack-plugin";
import compressionWebpackPlugin from "compression-webpack-plugin";
import copyWebpackPlugin from "copy-webpack-plugin";
import eslintPlugin from "eslint-webpack-plugin";
import htmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import type ts from "typescript";
import glslMinifyTransformer from "typescript-glslminify-transformer";
import type webpack from "webpack";
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

export default (env: any): webpack.Configuration & { devServer?: WebpackDevServerConfiguration } => ({
    entry: "./src/Test/index.ts",
    output: {
        path: path.join(__dirname, "/test_dist"),
        filename: "[name].bundle.js",
        clean: true
    },
    optimization: {
        minimize: env.production,
        splitChunks: {
            chunks: "all",
            cacheGroups: {
                glslShaders: {
                    test: (module: { type: string; resource: string | undefined }): boolean => {
                        if (module.resource === undefined) {
                            return false;
                        }
                        const resource = module.resource.replace(/\\/g, "/");
                        if (resource.includes("Shaders/")) {
                            return true;
                        }
                        return false;
                    },
                    name: "glslShaders",
                    chunks: "async",
                    enforce: true
                },
                wgslShaders: {
                    test: (module: { type: string; resource: string | undefined }): boolean => {
                        if (module.resource === undefined) {
                            return false;
                        }
                        const resource = module.resource.replace(/\\/g, "/");
                        if (resource.includes("ShadersWGSL/")) {
                            return true;
                        }
                        return false;
                    },
                    name: "wgslShaders",
                    chunks: "async",
                    enforce: true
                }
            }
        }
    },
    cache: true,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                options: {
                    getCustomTransformers: (program: ts.Program) => ({
                        before: [glslMinifyTransformer(program, { customPrefixes: ["glsl", "wgsl"] })]
                    })
                }
            },
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false
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
            "fs": false,
            "path": false
        }
    },
    node: {
        global: false,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __filename: false,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __dirname: false
    },
    plugins: ([
        new htmlWebpackPlugin({
            template: "./src/Test/index.html"
        }),
        new eslintPlugin({
            extensions: ["ts", "tsx"],
            fix: true,
            cache: true,
            configType: "flat"
        }),
        new copyWebpackPlugin({
            patterns: [
                { from: "res", to: "res" }
            ]
        })
    ] as webpack.Configuration["plugins"])!.concat(env.wasmInstance !== "js" ? [
        new wasmPackPlugin({
            crateDirectory: path.resolve(__dirname, "src/Runtime/Optimized/wasm_src"),
            outDir: path.resolve(__dirname, "src/Runtime/Optimized/wasm/" + env.wasmInstance),
            outName: "index",
            extraArgs: "--target web",
            forceMode: "development"
        })
    ] : []).concat(env.production ? [
        new compressionWebpackPlugin({
            test: /\.(js|wasm|bvmd|bpmx)$/i
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
        watchFiles: ["src/**/*"],
        server: "https",
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Cross-Origin-Opener-Policy": "same-origin",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Cross-Origin-Embedder-Policy": "require-corp"
        }
    },
    ignoreWarnings: [
        (warning): boolean => warning.message.includes("Circular dependency between chunks with runtime")
    ],
    mode: env.production ? "production" : "development"
});
