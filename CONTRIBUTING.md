# babylon-mmd Contributing Guide

An introduction to contributing to the babylon-mmd.

## Rules

The basic conventions required by the project are as follows:

- Follow the conventions of Babylon.js.
- Follow eslint rules.
- New features should be compatible with all existing parts whenever possible.
- API design should consider backward compatibility.
- Prioritize performance improvements even if it slightly reduces readability (avoid using js map, filter, iterator).

Most of the Babylon.js conventions are covered by eslint. The following are the items you need to check manually:

- Name folders in PascalCase.
- Name files in camelCase for classes and PascalCase for interfaces or types.
- Exception: For rust cargo project folders, use rust's naming conventions.

## Project Structure

Only the main directories of the project are listed.

- `res` - Test resource files.

- `src/Loader` - MMD asset loader.
- `src/Loader/Optimized` - Includes loaders for optimized formats like BPMX and BVMD.

- `src/Runtime` - Elements to animate MMD assets.
- `src/Runtime/Optimized` - Includes WebAssembly-based runtime.

- `src/Runtime/Optimized/wasm_src` - rust cargo project.

- `src/Test` - Test playground.

## Build setup

To build the project, you need to have the following dependencies installed:

- [nodejs](https://nodejs.org/en/) 20 or higher (may not work with 20.12.2 or later see the [issue](https://github.com/nodejs/node/issues/52554))
- [npm](https://www.npmjs.com/)
- [rust](https://www.rust-lang.org/) nightly-2024-11-19
- [llvm](https://github.com/llvm/llvm-project/releases/tag/llvmorg-19.1.3) 19.1.3
- [sccache](https://github.com/mozilla/sccache)

### Ubuntu

you can install the dependencies using the following commands:

#### install nodejs and npm:

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm
sudo npm update npm -g
sudo npm cache clean -f
sudo npm install -g n
sudo n stable
```

#### install clang and llvm:

<details>
<summary>for aarch64:</summary>

```bash
wget https://github.com/llvm/llvm-project/releases/download/llvmorg-19.1.3/clang+llvm-19.1.3-aarch64-linux-gnu.tar.xz
tar -xf clang+llvm-19.1.3-aarch64-linux-gnu.tar.xz
```

update PATH temporarily:

```bash
export PATH=$PWD/clang+llvm-19.1.3-aarch64-linux-gnu/bin:$PATH
```

update PATH permanently:

```bash
echo "export PATH=$PWD/clang+llvm-19.1.3-aarch64-linux-gnu/bin:\$PATH" >> ~/.bashrc
source ~/.bashrc
```

</details>

<details>
<summary>for x86_64:</summary>

```bash
wget https://github.com/llvm/llvm-project/releases/download/llvmorg-19.1.3/LLVM-19.1.3-Linux-X64.tar.xz
tar -xf LLVM-19.1.3-Linux-X64.tar.xz
```

update PATH temporarily:

```bash
export PATH=$PWD/LLVM-19.1.3-Linux-X64/bin:$PATH
```

update PATH permanently:

```bash
echo "export PATH=$PWD/LLVM-19.1.3-Linux-X64/bin:\$PATH" >> ~/.bashrc
source ~/.bashrc
```

</details>

#### install rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### install sccache:

```bash
cargo install sccache --locked
```

### Windows

you can install the dependencies using the following links:

- [nodejs and npm](https://nodejs.org/en/)
- [rust](https://www.rust-lang.org/)
- [clang and llvm](https://github.com/llvm/llvm-project/releases/tag/llvmorg-19.1.3) (add bin path to system path)
- scache (install using cargo)

#### clang and llvm installation details

Download `clang+llvm-19.1.3-x86_64-pc-windows-msvc.tar.xz` from the link above and extract it.

Add the extracted `bin` folder to the system path.

#### sccache installation

install sccache using the following command:

```bash
cargo install sccache --locked
```

## Build and run

### Setup

After installing the dependencies, run the following commands:

```bash
npm install
npm run build-wasm-all # for code generation
```
### Build

For run the development server with the test playground:

```bash
npm start
```

For build the test playground project:

```bash
npm run build
```

For build the project as a library:

```bash
npm run build-lib
```
