import { execSync } from "child_process";
import * as fs from "fs";

if (fs.existsSync("./dist")) {
    fs.rmSync("./dist", { recursive: true });
}

try {
    execSync("npm run build-lib");
} catch (error: any) {
    console.log(error.output.toString());
    process.exit(1);
}
if (!fs.existsSync("./dist")) {
    console.log("build failed");
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
delete packageJson.scripts;
fs.writeFileSync("./dist/package.json", JSON.stringify(packageJson, null, 4));

fs.copyFileSync("./README.md", "./dist/README.md");
fs.copyFileSync("./LICENSE", "./dist/LICENSE");
fs.copyFileSync("./CHANGELOG.md", "./dist/CHANGELOG.md");

// execSync("npm publish ./dist");
// fs.rmSync("./dist", { recursive: true });
