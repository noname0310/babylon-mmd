/**
 * Provides unique IDs for objects
 */
export class ObjectUniqueIdProvider {
    private static readonly _IdMap: WeakMap<object, number> = new WeakMap<object, number>();

    private static _NextId = 0;

    private constructor() { /* block constructor */ }

    /**
     * Get the unique ID of the object
     * @param obj Object
     * @returns Unique ID
     */
    public static GetId(obj: object): number {
        let id = this._IdMap.get(obj);
        if (id === undefined) {
            id = this._NextId;
            this._NextId += 1;
            this._IdMap.set(obj, id);
        }

        return id;
    }
}
