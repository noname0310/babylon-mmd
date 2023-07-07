export class ReferenceFileResolver {
    public readonly rootUrl: string;
    public readonly files: readonly File[];
    private readonly _fileMap: Map<string, File> = new Map<string, File>();

    public constructor(rootUrl: string, files: readonly File[]) {
        if (rootUrl.endsWith("/")) {
            this.rootUrl = rootUrl;
        } else {
            this.rootUrl = rootUrl + "/";
        }
        this.files = files;

        for (const file of files) {
            const fileFullPath = (file as any).webkitRelativePath as string;
            this._fileMap.set(this._normalizePath(fileFullPath), file);
        }
    }

    public resolve(path: string): File | undefined {
        const finalPath = this._normalizePath(this.rootUrl + path);
        return this._fileMap.get(finalPath);
    }

    private _normalizePath(path: string): string {
        return path.replace(/\\/g, "/").toUpperCase();
    }
}
