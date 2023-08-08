import { execSync } from "child_process";
import * as fs from "fs";

if (fs.existsSync("./dist")) {
    fs.rmdirSync("./dist", { recursive: true });
}

execSync("npm run build:lib");
if (!fs.existsSync("./dist")) {
    console.log("build failed");
    process.exit(1);
}

fs.copyFileSync("./package.json", "./dist/package.json");
fs.copyFileSync("./README.md", "./dist/README.md");
fs.copyFileSync("./LICENSE", "./dist/LICENSE");
fs.copyFileSync("./CHANGELOG.md", "./dist/CHANGELOG.md");

// execSync("npm publish ./dist");
// fs.rmdirSync("./dist", { recursive: true });
