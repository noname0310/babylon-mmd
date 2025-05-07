/**
 * Normalize path
 * @param path Path
 * @returns Normalized path
 */
export function PathNormalize(path: string): string {
    path = path.replace(/\\/g, "/");
    const pathArray = path.split("/");
    const resultArray = [];
    for (let i = 0; i < pathArray.length; ++i) {
        const pathElement = pathArray[i];
        if (pathElement === ".") {
            continue;
        } else if (pathElement === "..") {
            resultArray.pop();
        } else {
            resultArray.push(pathElement);
        }
    }
    return resultArray.join("/");
}
