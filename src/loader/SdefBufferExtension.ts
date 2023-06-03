import { VertexBuffer } from "@babylonjs/core";

export class SdefBufferExtension {
    public static readonly matricesSdefC0 = "matricesSdefC0";
    public static readonly matricesSdefRW0 = "matricesSdefRW0";
    public static readonly matricesSdefRW1 = "matricesSdefRW1";

    private static readonly _originalDeduceStride = VertexBuffer.DeduceStride;

    private static readonly deduceStrideExtended = function(kind: string): number {
        switch (kind) {
        case SdefBufferExtension.matricesSdefC0:
        case SdefBufferExtension.matricesSdefRW0:
        case SdefBufferExtension.matricesSdefRW1:
            return 3;
        default:
            return SdefBufferExtension._originalDeduceStride(kind);
        }
    };

    public static injectIfNeeded(): void {
        if (VertexBuffer.DeduceStride !== SdefBufferExtension.deduceStrideExtended) {
            VertexBuffer.DeduceStride = SdefBufferExtension.deduceStrideExtended;
        }
    }
}
