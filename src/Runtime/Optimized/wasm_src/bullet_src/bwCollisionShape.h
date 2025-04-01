#pragma once

#include "btBulletDynamicsMinimal.h"

extern "C" void* bw_create_boxshape(float x, float y, float z)
{
    btBoxShape* shape = new btBoxShape(btVector3(x, y, z));
    return shape;
}

extern "C" void bw_destroy_boxshape(void* shape)
{
    btBoxShape* s = static_cast<btBoxShape*>(shape);
    delete s;
}

extern "C" void* bw_create_sphereshape(float radius)
{
    btSphereShape* shape = new btSphereShape(radius);
    return shape;
}

extern "C" void bw_destroy_sphereshape(void* shape)
{
    btSphereShape* s = static_cast<btSphereShape*>(shape);
    delete s;
}

extern "C" void* bw_create_capsuleshape(float radius, float height)
{
    btCapsuleShape* shape = new btCapsuleShape(radius, height);
    return shape;
}

extern "C" void bw_destroy_capsuleshape(void* shape)
{
    btCapsuleShape* s = static_cast<btCapsuleShape*>(shape);
    delete s;
}

extern "C" void* bw_create_staticplaneshape(float x, float y, float z, float w)
{
    btStaticPlaneShape* shape = new btStaticPlaneShape(btVector3(x, y, z), w);
    return shape;
}

extern "C" void bw_destroy_staticplaneshape(void* shape)
{
    btStaticPlaneShape* s = static_cast<btStaticPlaneShape*>(shape);
    delete s;
}
