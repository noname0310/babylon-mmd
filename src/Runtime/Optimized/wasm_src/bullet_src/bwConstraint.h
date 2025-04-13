#pragma once

#include "btBulletDynamicsMinimal.h"
#include "bwRigidBody.h"

// The version of bullet physics used by MMD is 2.75, and in this version, the field m_useOffsetForConstraintFrame did not exist.
// In version 2.76, there was an update that changed the constraint handling logic, and by setting the m_useOffsetForConstraintFrame field to false, we can again use the behavior of version 2.75.
// We set m_useOffsetForConstraintFrame to false because we want the result to be as close to MMD's behavior as possible.

// We could modify the D6_USE_FRAME_OFFSET define to false, but in this project the principle is to not modify the source of the bullet physics, so we use inheritance to modify the member.

class bwMmdGeneric6DofSpringConstraint final : public btGeneric6DofSpringConstraint
{
public:
    bwMmdGeneric6DofSpringConstraint(btRigidBody& rbA, btRigidBody& rbB, const btTransform& frameInA, const btTransform& frameInB, bool useLinearReferenceFrameA)
        : btGeneric6DofSpringConstraint(rbA, rbB, frameInA, frameInB, useLinearReferenceFrameA)
    {
        m_useOffsetForConstraintFrame = false;
    }

    bwMmdGeneric6DofSpringConstraint(btRigidBody& rbB, const btTransform& frameInB, bool useLinearReferenceFrameB)
        : btGeneric6DofSpringConstraint(rbB, frameInB, useLinearReferenceFrameB)
    {
        m_useOffsetForConstraintFrame = false;
    }
};

// Generic 6 DOF ctor and dtor

extern "C" void* bw_create_generic6dofconstraint(void* bodyA, void* bodyB, float* frameABuffer, float* frameBBuffer, uint8_t useLinearReferenceFrameA)
{
    bwRigidBody* a = static_cast<bwRigidBody*>(bodyA);
    bwRigidBody* b = static_cast<bwRigidBody*>(bodyB);
    btTransform frameA;
    frameA.setFromOpenGLMatrix(frameABuffer);
    btTransform frameB;
    frameB.setFromOpenGLMatrix(frameBBuffer);
    btGeneric6DofConstraint* constraint = new btGeneric6DofConstraint(*a->getBody(), *b->getBody(), frameA, frameB, useLinearReferenceFrameA);
    return constraint;
}

extern "C" void bw_destroy_generic6dofconstraint(void* constraint)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    delete c;
}

// Generic 6 DOF constraint methods

extern "C" void bw_generic6dofconstraint_set_linear_lower_limit(void* constraint, float x, float y, float z)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    c->setLinearLowerLimit(btVector3(x, y, z));
}

extern "C" void bw_generic6dofconstraint_set_linear_upper_limit(void* constraint, float x, float y, float z)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    c->setLinearUpperLimit(btVector3(x, y, z));
}

extern "C" void bw_generic6dofconstraint_set_angular_lower_limit(void* constraint, float x, float y, float z)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    c->setAngularLowerLimit(btVector3(x, y, z));
}

extern "C" void bw_generic6dofconstraint_set_angular_upper_limit(void* constraint, float x, float y, float z)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    c->setAngularUpperLimit(btVector3(x, y, z));
}

extern "C" void bw_generic6dofconstraint_set_param(void* constraint, int num, float value, int axis)
{
    btGeneric6DofConstraint* c = static_cast<btGeneric6DofConstraint*>(constraint);
    c->setParam(num, value, axis);
}

// Generic 6 DOF spring ctor and dtor

extern "C" void* bw_create_generic6dofspringconstraint(void* bodyA, void* bodyB, float* frameABuffer, float* frameBBuffer, uint8_t useLinearReferenceFrameA)
{
    bwRigidBody* a = static_cast<bwRigidBody*>(bodyA);
    bwRigidBody* b = static_cast<bwRigidBody*>(bodyB);
    btTransform frameA;
    frameA.setFromOpenGLMatrix(frameABuffer);
    btTransform frameB;
    frameB.setFromOpenGLMatrix(frameBBuffer);
    btGeneric6DofSpringConstraint* constraint = new btGeneric6DofSpringConstraint(*a->getBody(), *b->getBody(), frameA, frameB, useLinearReferenceFrameA);
    return constraint;
}

extern "C" void bw_destroy_generic6dofspringconstraint(void* constraint)
{
    btGeneric6DofSpringConstraint* c = static_cast<btGeneric6DofSpringConstraint*>(constraint);
    delete c;
}

// Generic 6 DOF spring methods

extern "C" void bw_generic6dofspringconstraint_enable_spring(void* constraint, uint8_t index, uint8_t onOff)
{
    btGeneric6DofSpringConstraint* c = static_cast<btGeneric6DofSpringConstraint*>(constraint);
    c->enableSpring(index, onOff);
}

extern "C" void bw_generic6dofspringconstraint_set_stiffness(void* constraint, uint8_t index, float stiffness)
{
    btGeneric6DofSpringConstraint* c = static_cast<btGeneric6DofSpringConstraint*>(constraint);
    c->setStiffness(index, stiffness);
}

extern "C" void bw_generic6dofspringconstraint_set_damping(void* constraint, uint8_t index, float damping)
{
    btGeneric6DofSpringConstraint* c = static_cast<btGeneric6DofSpringConstraint*>(constraint);
    c->setDamping(index, damping);
}

// MmdGeneric6DofSpring ctor and dtor

extern "C" void* bw_create_mmdgeneric6dofspringconstraint(void* bodyA, void* bodyB, float* frameABuffer, float* frameBBuffer, uint8_t useLinearReferenceFrameA)
{
    bwRigidBody* a = static_cast<bwRigidBody*>(bodyA);
    bwRigidBody* b = static_cast<bwRigidBody*>(bodyB);
    btTransform frameA;
    frameA.setFromOpenGLMatrix(frameABuffer);
    btTransform frameB;
    frameB.setFromOpenGLMatrix(frameBBuffer);
    bwMmdGeneric6DofSpringConstraint* constraint = new bwMmdGeneric6DofSpringConstraint(*a->getBody(), *b->getBody(), frameA, frameB, useLinearReferenceFrameA);
    return constraint;
}

extern "C" void bw_destroy_mmdgeneric6dofspringconstraint(void* constraint)
{
    bwMmdGeneric6DofSpringConstraint* c = static_cast<bwMmdGeneric6DofSpringConstraint*>(constraint);
    delete c;
}
