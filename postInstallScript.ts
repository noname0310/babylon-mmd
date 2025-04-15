import { execSync } from "child_process";
import * as fs from "fs";
import https from "https";

async function download(url: string, dest: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function installAmmo(): Promise<void> {
    if (fs.existsSync("./src/Runtime/Physics/External/ammo.wasm.d.ts")) return;

    await download(
        "https://raw.githubusercontent.com/kripken/ammo.js/1ed8b58c7058a5f697f2642ceef8ee20fdd55e10/builds/ammo.wasm.js",
        "./src/Runtime/Physics/External/ammo.wasm.js"
    );
    await download(
        "https://raw.githubusercontent.com/kripken/ammo.js/1ed8b58c7058a5f697f2642ceef8ee20fdd55e10/builds/ammo.wasm.wasm",
        "./src/Runtime/Physics/External/ammo.wasm.wasm"
    );
    await download(
        "https://raw.githubusercontent.com/giniedp/ammojs-typed/05408a318256ca561720aad1cfd0e83e772f06cb/ammo/ammo.d.ts",
        "./src/Runtime/Physics/External/ammo.wasm.d.ts"
    );

    try {
        execSync("cd src/Runtime/Physics/External && git init && git apply ammo-bundler.patch");
    } catch (error: any) {
        console.log(error.output.toString());
        process.exit(1);
    }
    if (fs.existsSync("./src/Runtime/Physics/External/.git")) {
        fs.rmSync("./src/Runtime/Physics/External/.git", { recursive: true });
    }
}

async function installBullet(): Promise<void> {
    let updated = false;

    if (!fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletCollision")) {
        try {
            execSync("cd src/Runtime/Optimized/wasm_src/bullet_src && github-directory-downloader https://github.com/bulletphysics/bullet3/tree/d7f9d662076ed8c7cc2a62720ffbc7aea574cf3e/src/BulletCollision --dir=BulletCollision");
            updated = true;
        } catch (error: any) {
            console.log(error.output.toString());
            if (fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletCollision")) {
                fs.rmSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletCollision", { recursive: true });
            }
            process.exit(1);
        }
    }

    if (!fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletDynamics")) {
        try {
            execSync("cd src/Runtime/Optimized/wasm_src/bullet_src && github-directory-downloader https://github.com/bulletphysics/bullet3/tree/d7f9d662076ed8c7cc2a62720ffbc7aea574cf3e/src/BulletDynamics --dir=BulletDynamics");
            updated = true;
        } catch (error: any) {
            console.log(error.output.toString());
            if (fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletDynamics")) {
                fs.rmSync("./src/Runtime/Optimized/wasm_src/bullet_src/BulletDynamics", { recursive: true });
            }
            process.exit(1);
        }
    }

    if (!fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/LinearMath")) {
        try {
            execSync("cd src/Runtime/Optimized/wasm_src/bullet_src && github-directory-downloader https://github.com/bulletphysics/bullet3/tree/d7f9d662076ed8c7cc2a62720ffbc7aea574cf3e/src/LinearMath --dir=LinearMath");
            updated = true;
        } catch (error: any) {
            console.log(error.output.toString());
            if (fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/LinearMath")) {
                fs.rmSync("./src/Runtime/Optimized/wasm_src/bullet_src/LinearMath", { recursive: true });
            }
            process.exit(1);
        }
    }

    if (updated) {
        try {
            execSync("cd src/Runtime/Optimized/wasm_src/bullet_src && git init && git apply constraint-fix.patch");
        } catch (error: any) {
            console.log(error.output.toString());
            process.exit(1);
        }
        if (fs.existsSync("./src/Runtime/Optimized/wasm_src/bullet_src/.git")) {
            fs.rmSync("./src/Runtime/Optimized/wasm_src/bullet_src/.git", { recursive: true });
        }
    }
}

async function main(): Promise<void> {
    await installAmmo();
    await installBullet();
}

main();
