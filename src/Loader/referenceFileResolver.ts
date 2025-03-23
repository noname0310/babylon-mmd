import { pathNormalize } from "./Util/pathNormalize";

/**
 * This is a wrapper to treat the arraybuffer as a file
 */
export interface IArrayBufferFile {
    /**
     * Relative path of the texture e.g. "tex/texture.png"
     *
     * Used as a key to load the texture not as a path
     */
    readonly relativePath: string;

    /**
     * MIME type of the texture
     *
     * e.g. "image/png"
     */
    readonly mimeType: string | undefined;

    /**
     * Texture data encoded in PNG/JPG/BMP
     */
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
    private readonly _rootUrl: string;
    private readonly _fileRootId: string;
    private readonly _fileMap: Map<string, T> = new Map<string, T>();

    /**
     * Create a reference file resolver
     *
     * File root id can be root url, and becomes id for formats where texture is included in binary files, such as BPMX
     * @param files File list
     * @param rootUrl Root url for trim the path of the files
     * @param fileRootId File root id for give the unique id for the files
     */
    public constructor(files: readonly T[], rootUrl: string, fileRootId: string) {
        this.files = files;
        this._rootUrl = pathNormalize(rootUrl);
        this._fileRootId = fileRootId;

        if (files.length === 0) return;

        if (files[0] instanceof File) {
            for (const file of files) {
                const fileRelativePath = pathNormalize((file as File).webkitRelativePath);
                const relativePath = fileRootId + pathNormalize(fileRelativePath);
                this._fileMap.set(pathNormalize(relativePath).toUpperCase(), file);
            }
        } else {
            for (const file of files) {
                const relativePath = fileRootId + pathNormalize(this._rootUrl + (file as IArrayBufferFile).relativePath);
                this._fileMap.set(pathNormalize(relativePath).toUpperCase(), file);
            }
        }
    }

    /**
     * Create full path from relative path for resolve the file
     * @param relativePath Relative path
     * @returns Full path
     */
    public createFullPath(relativePath: string): string {
        return this._fileRootId + pathNormalize(this._rootUrl + relativePath);
    }

    /**
     * Resolve the file from the path
     * @param path Path
     * @returns File
     */
    public resolve(path: string): T | undefined {
        const finalPath = pathNormalize(path);
        return this._fileMap.get(finalPath.toUpperCase());
    }
}
