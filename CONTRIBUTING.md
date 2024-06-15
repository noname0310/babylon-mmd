# babylon-mmd Contributing Guide

An introduction to contributing to the babylon-mmd project.

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

<br/>

- `src/Loader` - MMD asset loader.
- `src/Loader/Optimized` - Includes loaders for optimized formats like BPMX and BVMD.

<br/>

- `src/Runtime` - Elements to animate MMD assets.
- `src/Runtime/Optimized` - Includes WebAssembly-based runtime.

- `src/Runtime/Optimized/wasm_src` - rust cargo project.

<br/>

- `src/Test` - Test playground.

## Build setup

To build the project, you need to have the following dependencies installed:

- [nodejs](https://nodejs.org/en/)
- [npm](https://www.npmjs.com/)
- [rust](https://www.rust-lang.org/)
- [clang](https://clang.llvm.org/)
- [llvm](https://llvm.org/)
- [sccache](https://github.com/mozilla/sccache)

### Ubuntu

you can install the dependencies using the following commands:

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm clang llvm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install sccache --locked
```

### Windows

you can install the dependencies using the following links:

- [nodejs and npm](https://nodejs.org/en/)
- [rust](https://www.rust-lang.org/)
- [clang and llvm](https://visualstudio.microsoft.com/vs/) (install visual studio with Clang and LLVM tools)

#### clang and llvm installation details

![vs installer screenshot](docs/static/img/vs_installer_screenshot.png)

Make sure to install the Clang and LLVM tools when installing visual studio.

<br/>

You need to add the following paths to the system path:

`C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\Llvm\bin`

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
