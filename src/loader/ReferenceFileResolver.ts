export interface IArrayBufferFile {
    readonly relativePath: string;
    readonly data: ArrayBuffer;
}

export class ReferenceFileResolver<T extends File | IArrayBufferFile = File | IArrayBufferFile> {
    public readonly files: readonly T[];
    private readonly _fileMap: Map<string, T> = new Map<string, T>();

    public constructor(files: readonly T[], rootUrl: string, fileRootId: string) {
        rootUrl = this._pathNormalize(rootUrl);

        this.files = files;

        if (files.length === 0) return;


        if (files[0] instanceof File) {
            for (const file of files) {
                const fileRelativePath = this._pathNormalize((file as File).webkitRelativePath);

                const relativePath = fileRootId + fileRelativePath.slice(rootUrl.length);
                this._fileMap.set(this._pathNormalize(relativePath), file);
            }
        } else {
            for (const file of files) {
                const relativePath = fileRootId + (file as IArrayBufferFile).relativePath;
                this._fileMap.set(this._pathNormalize(relativePath), file);
            }
        }
    }

    public resolve(path: string): T | undefined {
        const finalPath = this._pathNormalize(path);
        return this._fileMap.get(finalPath);
    }

    private _pathNormalize(path: string): string {
        return path.replace(/\\/g, "/").toUpperCase();
    }
}
