import path from "path";
import type webpack from "webpack";

export default (env: any): webpack.Configuration => ({
    entry: "./src/libIndex.ts",
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
        globalObject: "(typeof self !== \"undefined\" ? self : typeof global !== \"undefined\" ? global : this)",
        clean: true
    },
    optimization: {
        minimize: env.production
    },
    module: {
        rules: [{ test: /\.tsx?$/, loader: "ts-loader" }]
    },
    resolve: {
        alias: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "@": path.resolve(__dirname, "src")
        },
        modules: ["src", "node_modules"],
        extensions: [".js", ".jsx", ".ts", ".tsx"]
    },
    externals: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "@babylonjs/core": {
            amd: "@babylonjs/core",
            commonjs: "@babylonjs/core",
            commonjs2: "@babylonjs/core",
            root: "BABYLON"
        }
    },
    mode: env.production ? "production" : "development"
});
