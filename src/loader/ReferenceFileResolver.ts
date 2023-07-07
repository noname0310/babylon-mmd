export class ReferenceFileResolver {
    public readonly files: readonly File[];
    private readonly _fileMap: Map<string, File> = new Map<string, File>();

    public constructor(files: readonly File[]) {
        this.files = files;

        for (const file of files) {
            const fileFullPath = (file as any).webkitRelativePath as string;
            this._fileMap.set(this._pathNormalize(fileFullPath), file);
        }
    }

    public resolve(path: string): File | undefined {
        const finalPath = this._pathNormalize(path);
        return this._fileMap.get(finalPath);
    }

    private _pathNormalize(path: string): string {
        return path.replace(/\\/g, "/").toUpperCase();
    }
}
