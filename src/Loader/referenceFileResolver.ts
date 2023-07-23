/**
 * This is a wrapper to treat the arraybuffer as a file
 */
export interface IArrayBufferFile {
    readonly relativePath: string;
    readonly data: ArrayBuffer;
}

/**
 * Reference file resolver
 *
 * This class is used to resolve the file from the path
 *
 * It's responsibility is similar to a file system
 */
export class ReferenceFileResolver<T extends File | IArrayBufferFile = File | IArrayBufferFile> {
    /**
     * File list that can be resolved
     */
    public readonly files: readonly T[];
    private readonly _fileMap: Map<string, T> = new Map<string, T>();

    /**
     * Create a reference file resolver
     *
     * File root id can be root url, and becomes id for formats where texture is included in binary files, such as BPMX
     * @param files File list
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @returns
     */
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

    /**
     * Resolve the file from the path
     * @param path Path
     * @returns File
     */
    public resolve(path: string): T | undefined {
        const finalPath = this._pathNormalize(path);
        return this._fileMap.get(finalPath);
    }

    /**
     * Normalize the path
     * @param path Path
     * @returns Normalized path
     */
    private _pathNormalize(path: string): string {
        return path.replace(/\\/g, "/").toUpperCase();
    }
}
