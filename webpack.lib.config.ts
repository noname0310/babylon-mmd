import path from "path";
import type ts from "typescript";
import glslMinifyTransformer from "typescript-glslminify-transformer";
import type webpack from "webpack";

export default (env: any): webpack.Configuration => ({
    entry: "./src/index.ts",
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist/umd"),
        filename: `babylon.mmd${env.production ? ".min" : ""}.js`,
        library: {
            name: {
                amd: "babylon-mmd",
                commonjs: "babylon-mmd",
                root: "BABYLONMMD"
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
        parser: {
            javascript: {
                dynamicImportMode: "eager"
            }
        },
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
            }
        ]
    },
    resolve: {
        alias: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "@": path.resolve(__dirname, "src")
        },
        modules: ["src", "node_modules"],
        extensions: [".js", ".jsx", ".ts", ".tsx"]
    },
    externals: [
        ({request}, callback): void => {
            if (/^@babylonjs\/core\//.test(request!)) {
                return callback(null, {
                    amd: request,
                    commonjs: request,
                    commonjs2: request,
                    root: "BABYLON"
                });
            }
            callback();
        }
    ],
    mode: env.production ? "production" : "development"
});
