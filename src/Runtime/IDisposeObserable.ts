import type { Observable } from "@babylonjs/core/Misc/observable";

/**
 * Disposeable object interface
 */
export interface IDisposeObservable {
    /**
     * On dispose observable
     *
     * This observable is notified when the object is disposed
     */
    readonly onDisposeObservable: Observable<any>;
}
