/**
 * BabylonVMD(BVMD) representation
 * prerequisite: frames are sorted by frameNumber
 * 
 * signature: uint8[4] "BVMD"
 * version: int8[3] - major, minor, patch
 * 
 * boneTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  rotations: float32[frameCount * 4] - [..., x, y, z, w, ...]
 *  rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 * }[boneTrackCount]
 * 
 * moveableBoneTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  positions: float32[frameCount * 3] - [..., x, y, z, ...]
 *  positionInterpolations: uint8[frameCount * 12] - [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
 *  rotations: float32[frameCount * 4] - [..., x, y, z, w, ...]
 *  rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 * }[moveableBoneTrackCount]
 * 
 * morphTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  weights: float32[frameCount] - [..., weight, ...]
 * }[morphTrackCount]
 * 
 * propertyTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  visibles: uint8[frameCount] - [..., visible, ...]
 *  ikBoneNameCount: uint32
 *  ikBoneNames: uint32[ikBoneNameCount] - uint8[] - length, string
 *  ikStates: uint8[ikBoneNameCount][frameCount] - [..., ikState, ...]
 * }[propertyTrackCount]
 * 
 * cameraTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  positions: float32[frameCount * 3] - [..., x, y, z, ...]
 *  positionInterpolations: uint8[frameCount * 12] - [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
 *  rotations: float32[frameCount * 3] - [..., x, y, z, ...]
 *  rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 *  distances: float32[frameCount] - [..., distance, ...]
 *  distanceInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 *  fovs: float32[frameCount] - [..., fov, ...]
 *  fovInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 * }[cameraTrackCount]
 */
