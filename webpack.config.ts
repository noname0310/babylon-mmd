import CopyWebpackPlugin from "copy-webpack-plugin";
import CssMinimizerWebpackPlugin from "css-minimizer-webpack-plugin";
import ESLintPlugin from "eslint-webpack-plugin";
import ExtractCssChunks from "extract-css-chunks-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CompressionWebpackPlugin from "compression-webpack-plugin";
import path from "path";
import type webpack from "webpack";
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

export default (env: any): webpack.Configuration & { devServer?: WebpackDevServerConfiguration } => ({
    entry: "./src/test/index.ts",
    output: {
        path: path.join(__dirname, "/test_dist"),
        filename: "[name].bundle.js",
        clean: true
    },
    optimization: {
        minimize: env.production,
        minimizer: [
            "...",
            new CssMinimizerWebpackPlugin()
        ],
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: "vendors",
                    chunks: "all"
                }
            }
        }
    },
    cache: true,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.(png|jpg|gif)$/,
                loader: "file-loader",
                options: {
                    name: "[name].[hash:8].[ext]",
                    outputPath: "assets"
                }
            },
            {
                test: /\.html$/,
                loader: "html-loader"
            },
            {
                test: /\.css$/,
                exclude: /\.module\.css$/,
                use: [
                    ExtractCssChunks.loader,
                    "css-loader"
                ]
            },
            {
                test: /\.module\.css$/,
                use: [
                    ExtractCssChunks.loader,
                    {
                        loader: "css-loader",
                        options: {
                            modules: {
                                localIdentName: "[name]__[local]--[hash:base64:5]",
                                exportLocalsConvention: "camelCase"
                            }
                        }
                    }
                ]
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
        new HtmlWebpackPlugin({
            template: "./src/test/index.html"
        }),
        new ExtractCssChunks({
            filename: "[name].css",
            chunkFilename: "[id].css"
        }) as any,
        new ESLintPlugin({
            extensions: ["ts", "tsx"],
            fix: true,
            cache: true
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: "res", to: "res" }
            ]
        })
    ].concat(env.production ? [
        new CompressionWebpackPlugin({
            test: /\.(js|bvmd|bpmx)$/i,
        })
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
