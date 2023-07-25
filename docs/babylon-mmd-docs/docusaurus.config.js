// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import("@docusaurus/types").Config} */
const config = {
    title: "babylon-mmd",
    tagline: "MMD loader and runtime for Babylon.js",
    favicon: "img/favicon.ico",

    // Set the production url of your site here
    url: "https://noname0310.github.io/",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often "/<projectName>/"
    baseUrl: "/babylon-mmd/docs/docs_bulid/",

    // GitHub pages deployment config.
    // If you aren"t using GitHub pages, you don"t need these.
    organizationName: "noname0310", // Usually your GitHub org/user name.
    projectName: "babylon-mmd", // Usually your repo name.

    onBrokenLinks: "throw",
    onBrokenMarkdownLinks: "warn",

    // Even if you don"t use internalization, you can use this field to set useful
    // metadata like html lang. For example, if your site is Chinese, you may want
    // to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },

    presets: [
        [
            "classic",
            /** @type {import("@docusaurus/preset-classic").Options} */
            ({
                docs: {
                    sidebarPath: require.resolve("./sidebars.js"),
                    editUrl: "https://github.com/noname0310/babylon-mmd/tree/main/docs/babylon-mmd-docs/",
                },
                blog: {
                    showReadingTime: true,
                    editUrl: "https://github.com/noname0310/babylon-mmd/tree/main/docs/babylon-mmd-docs/",
                },
                theme: {
                    customCss: require.resolve("./src/css/custom.css"),
                },
            }),
        ],
    ],

    themeConfig:
        /** @type {import("@docusaurus/preset-classic").ThemeConfig} */
        ({
            // image: "img/docusaurus-social-card.jpg",
            navbar: {
                title: "babylon-mmd",
                // logo: {
                //     alt: "babylon-mmd Logo",
                //     src: "img/logo.svg",
                // },
                items: [
                    {
                        type: "docSidebar",
                        sidebarId: "docsSidebar",
                        position: "left",
                        label: "Docs",
                    },
                    { to: "/blog", label: "Blog", position: "left" },
                    {
                        href: "https://github.com/noname0310/babylon-mmd",
                        label: "GitHub",
                        position: "right",
                    },
                ],
            },
            footer: {
                style: "dark",
                // links: [
                //     {
                //         title: "Docs",
                //         items: [
                //             {
                //                 label: "Tutorial",
                //                 to: "/docs/intro",
                //             },
                //         ],
                //     },
                //     {
                //         title: "Community",
                //         items: [
                //             {
                //                 label: "Stack Overflow",
                //                 href: "https://stackoverflow.com/questions/tagged/docusaurus",
                //             },
                //             {
                //                 label: "Discord",
                //                 href: "https://discordapp.com/invite/docusaurus",
                //             },
                //             {
                //                 label: "Twitter",
                //                 href: "https://twitter.com/docusaurus",
                //             },
                //         ],
                //     },
                //     {
                //         title: "More",
                //         items: [
                //             {
                //                 label: "Blog",
                //                 to: "/blog",
                //             },
                //             {
                //                 label: "GitHub",
                //                 href: "https://github.com/facebook/docusaurus",
                //             },
                //         ],
                //     },
                // ],
                copyright: `Copyright © ${new Date().getFullYear()} noname0310 all rights reserved. Built with Docusaurus.`,
            },
            prism: {
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme,
            },
        }),
};

module.exports = config;
