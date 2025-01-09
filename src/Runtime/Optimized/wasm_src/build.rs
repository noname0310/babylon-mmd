fn main() {
    #[cfg(feature = "physics")]
    {
        let mut build = cc::Build::new();

        build
            .warnings(false)
            .archiver("llvm-ar")
            .cpp_link_stdlib(None)
            .cpp(true)
            .flag("-xc++");

        #[cfg(feature = "parallel")]
        build
            .flag("-matomics")
            .flag("-mbulk-memory");
        
        build
            .flag("-msimd128")
            .flag("-Wno-c++11-narrowing")
            .flag("-Wno-deprecated-declarations")
            .flag("-Wno-#pragma-messages")
            .flag("-fno-exceptions")

            // for use simd instructions
            .define("_WIN32", None)
            .define("_MSC_VER", "1401")
            .define("__i386__", None)
            .define("__SSE__", None)
            .define("__SSE2__", None)
            .define("__SSE3__", None)
            .define("__SSSE3__", None)
            .define("__SSE4_1__", None)
            .define("BT_USE_SSE", None)
            // .define("BT_USE_SSE_IN_API", None)
            .define("BT_NO_SIMD_OPERATOR_OVERLOADS", None)
            .define("BT_USE_SIMD_VECTOR3", None)
            .define("__wasm32__", None)
            
            .includes([
                "bullet_stdlib",
                "bullet_src"
            ])
            .files([
                "bullet_src/lib.cpp",
                "bullet_stdlib/cxa_guard.cpp",
                "bullet_stdlib/stdio.cpp",
                "bullet_stdlib/string_c.cpp",
                "bullet_stdlib/string.cpp",
                "bullet_stdlib/windows.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btBroadphaseProxy.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btDbvt.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btDbvtBroadphase.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btDispatcher.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btOverlappingPairCache.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btQuantizedBvh.cpp",
                "bullet_src/BulletCollision/BroadphaseCollision/btSimpleBroadphase.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btActivatingCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btBoxBoxCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btBoxBoxDetector.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btCollisionWorld.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btCollisionDispatcher.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btCollisionObject.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btCompoundCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btCompoundCompoundCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btConvexConcaveCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btConvexConvexAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btConvexPlaneCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btDefaultCollisionConfiguration.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btEmptyCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btHashedSimplePairCache.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btManifoldResult.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btSimulationIslandManager.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btSphereSphereCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btSphereTriangleCollisionAlgorithm.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/btUnionFind.cpp",
                "bullet_src/BulletCollision/CollisionDispatch/SphereTriangleDetector.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btBoxShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btBvhTriangleMeshShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btCapsuleShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btCollisionShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btCompoundShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConcaveShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConeShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexHullShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexInternalShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexPointCloudShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexPolyhedron.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btConvexTriangleMeshShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btCylinderShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btHeightfieldTerrainShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btMiniSDF.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btMinkowskiSumShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btMultiSphereShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btOptimizedBvh.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btPolyhedralConvexShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btScaledBvhTriangleMeshShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btSdfCollisionShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btSphereShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btStaticPlaneShape.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btStridingMeshInterface.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btTriangleCallback.cpp",
                "bullet_src/BulletCollision/CollisionShapes/btTriangleMeshShape.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btContinuousConvexCollision.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btConvexCast.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btGjkConvexCast.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btGjkEpa2.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btGjkEpaPenetrationDepthSolver.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btGjkPairDetector.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btMinkowskiPenetrationDepthSolver.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btPersistentManifold.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btPolyhedralContactClipping.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btRaycastCallback.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btSubSimplexConvexCast.cpp",
                "bullet_src/BulletCollision/NarrowPhaseCollision/btVoronoiSimplexSolver.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btConeTwistConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btContactConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btGeneric6DofConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btGeneric6DofSpring2Constraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btGeneric6DofSpringConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btHingeConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btPoint2PointConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btSliderConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btTypedConstraint.cpp",
                "bullet_src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp",
                "bullet_src/BulletDynamics/Dynamics/btDiscreteDynamicsWorld.cpp",
                "bullet_src/BulletDynamics/Dynamics/btRigidBody.cpp",
                "bullet_src/LinearMath/btAlignedAllocator.cpp",
                "bullet_src/LinearMath/btConvexHullComputer.cpp",
                "bullet_src/LinearMath/btGeometryUtil.cpp",
                "bullet_src/LinearMath/btQuickprof.cpp",
                "bullet_src/LinearMath/btSerializer.cpp",
                "bullet_src/LinearMath/btThreads.cpp",
                "bullet_src/LinearMath/btVector3.cpp",
            ])
            .opt_level_str("3")
            .flag("-flto")
            .compile("bullet");

        println!("cargo:rerun-if-changed=bullet_stdlib");
        println!("cargo:rerun-if-changed=bullet_src/lib.cpp");
    }
}
