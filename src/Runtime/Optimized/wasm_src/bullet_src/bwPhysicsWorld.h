#pragma once

#include "btBulletDynamicsMinimal.h"
#include "bwRigidBody.h"

class bwOverlapFilterCallback final : public btOverlapFilterCallback
{
    virtual bool needBroadphaseCollision(btBroadphaseProxy* proxy0, btBroadphaseProxy* proxy1) const override
    {
        const uint16_t invGroup0 = proxy0->m_collisionFilterGroup >> 16;
        const uint16_t invGroup1 = proxy1->m_collisionFilterGroup >> 16;
        
        if ((invGroup0 & invGroup1) != 0)
        {
            return false;
        }

        const uint16_t group0 = proxy0->m_collisionFilterGroup;
        const uint16_t mask0 = proxy0->m_collisionFilterMask;
        const uint16_t group1 = proxy1->m_collisionFilterGroup;
        const uint16_t mask1 = proxy1->m_collisionFilterMask;

        bool collides = (group0 & mask0) != 0;
        collides = collides && (group1 & mask1);
        return collides;
    }
};

class bwPhysicsWorld final
{
private:
    bwOverlapFilterCallback m_overlapFilterCallback;
    btHashedOverlappingPairCache m_broadphasePairCache;
    btDbvtBroadphase m_broadphase;
    btDefaultCollisionConfiguration m_collisionConfig;
    btCollisionDispatcher m_dispatcher;
    btSequentialImpulseConstraintSolver m_solver;
    btDiscreteDynamicsWorld m_world;

public:
    bwPhysicsWorld() :
        m_overlapFilterCallback(),
        m_broadphasePairCache(),
        m_broadphase(&m_broadphasePairCache),
        m_collisionConfig(),
        m_dispatcher(&m_collisionConfig),
        m_solver(),
        m_world(&m_dispatcher, &m_broadphase, &m_solver, &m_collisionConfig)
    {
        m_broadphasePairCache.setOverlapFilterCallback(&m_overlapFilterCallback);
    }

    bwPhysicsWorld(bwPhysicsWorld const&) = delete;
    bwPhysicsWorld& operator=(bwPhysicsWorld const&) = delete;

    // ~bwPhysicsWorld()
    // {
    //     delete m_world;
    //     delete m_solver;
    //     delete m_dispatcher;
    //     delete m_collisionConfig;
    //     delete m_broadphase;
    // }
    
    void setGravity(btScalar x, btScalar y, btScalar z)
    {
        m_world.setGravity(btVector3(x, y, z));
    }

    void stepSimulation(btScalar timeStep, int maxSubSteps, btScalar fixedTimeStep)
    {
        m_world.stepSimulation(timeStep, maxSubSteps, fixedTimeStep);
    }

    void addRigidBody(bwRigidBody* body)
    {
        int group = body->getCollisionGroup();
        const bwRigidBodyMotionType motionType = body->getMotionType();
        if (motionType == bwRigidBodyMotionType::KINEMATIC || motionType == bwRigidBodyMotionType::STATIC)
        {
            group |= (btBroadphaseProxy::StaticFilter << 16);
        }

        const int16_t mask = body->getCollisionMask();

        m_world.addRigidBody(body->getBody(), group, mask);
        body->setWorld(this);
    }

    void removeRigidBody(bwRigidBody* body)
    {
        m_world.removeRigidBody(body->getBody());
        body->setWorld(nullptr);
    }

    void addRigidBodyShadow(bwRigidBodyShadow* shadow)
    {
        int group = shadow->getCollisionGroup();
        group |= (btBroadphaseProxy::StaticFilter << 16);
        const int16_t mask = shadow->getCollisionMask();

        m_world.addRigidBody(shadow->getBody(), group, mask);
    }

    void removeRigidBodyShadow(bwRigidBodyShadow* shadow)
    {
        m_world.removeRigidBody(shadow->getBody());
    }

    void addConstraint(btTypedConstraint* constraint, bool disableCollisionsBetweenLinkedBodies)
    {
        m_world.addConstraint(constraint, disableCollisionsBetweenLinkedBodies);
    }

    void removeConstraint(btTypedConstraint* constraint)
    {
        m_world.removeConstraint(constraint);
    }

    void makeBodyKinematic(bwRigidBody* body)
    {
        btRigidBody* btBody = body->getBody();
#ifdef BT_DEBUG
        btCollisionObjectArray& objs = m_world.getCollisionObjectArray();
        // check body is in this world
        int iObj = btBody->getWorldArrayIndex();
        if (iObj >= 0 && iObj < objs.size())
        {
            btAssert(btBody == objs[iObj]);
        }
        else
        {
            const bool found = objs.findLinearSearch(btBody) != objs.size();
            btAssert(found);
        }
#endif
        btAssert(body->getMotionType() == bwRigidBodyMotionType::DYNAMIC);

        // handle multiple calls to makeBodyKinematic
        if (btBody->getCollisionFlags() & btCollisionObject::CF_KINEMATIC_OBJECT)
        {
            return;
        }
        
        btBody->setCollisionFlags(btBody->getCollisionFlags() | btCollisionObject::CF_KINEMATIC_OBJECT);
        btBroadphaseProxy* proxy = btBody->getBroadphaseHandle();
        proxy->m_collisionFilterGroup |= (btBroadphaseProxy::StaticFilter << 16);
        m_broadphasePairCache.cleanProxyFromPairs(proxy, &m_dispatcher);
        m_world.refreshBroadphaseProxy(btBody);
    }

    void restoreBodyDynamic(bwRigidBody* body)
    {
        btRigidBody* btBody = body->getBody();
#ifdef BT_DEBUG
        btCollisionObjectArray& objs = m_world.getCollisionObjectArray();
        // check body is in this world
        int iObj = btBody->getWorldArrayIndex();
        if (iObj >= 0 && iObj < objs.size())
        {
            btAssert(btBody == objs[iObj]);
        }
        else
        {
            const bool found = objs.findLinearSearch(btBody) != objs.size();
            btAssert(found);
        }
#endif
        btAssert(body->getMotionType() == bwRigidBodyMotionType::DYNAMIC);

        // handle multiple calls to restoreBodyDynamic
        if (!(btBody->getCollisionFlags() & btCollisionObject::CF_KINEMATIC_OBJECT))
        {
            return;
        }

        btBody->setLinearVelocity(btVector3(0.0f, 0.0f, 0.0f));
        btBody->setAngularVelocity(btVector3(0.0f, 0.0f, 0.0f));
        btBody->setCollisionFlags(btBody->getCollisionFlags() & ~btCollisionObject::CF_KINEMATIC_OBJECT);
        btBroadphaseProxy* proxy = btBody->getBroadphaseHandle();
        proxy->m_collisionFilterGroup &= ~(btBroadphaseProxy::StaticFilter << 16);
        m_broadphasePairCache.cleanProxyFromPairs(proxy, &m_dispatcher);
        m_world.refreshBroadphaseProxy(btBody);
    }

    void cleanBodyProxyFromPairs(bwRigidBody* body)
    {
        btBroadphaseProxy* proxy = body->getBody()->getBroadphaseHandle();
        m_broadphasePairCache.cleanProxyFromPairs(proxy, &m_dispatcher);
    }
};

// for better complier optimization, we don't separate the .cpp file
// so bwRigidBody::setShape is defined here due to dependency on bwPhysicsWorld
void bwRigidBody::setShape(btCollisionShape* shape)
{
    m_shape = shape;
    m_body.setCollisionShape(shape);
    if (m_world) {
        m_world->cleanBodyProxyFromPairs(this);
    }
}

extern "C" void* bw_create_world()
{
    bwPhysicsWorld* world = new bwPhysicsWorld();
    return world;
}

extern "C" void bw_destroy_world(void* world)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    delete w;
}

extern "C" void bw_world_set_gravity(void* world, float x, float y, float z)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    w->setGravity(x, y, z);
}

extern "C" void bw_world_step_simulation(void* world, float timeStep, int maxSubSteps, float fixedTimeStep)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    w->stepSimulation(timeStep, maxSubSteps, fixedTimeStep);
}

extern "C" void bw_world_add_rigidbody(void* world, void* body)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    w->addRigidBody(b);
}

extern "C" void bw_world_remove_rigidbody(void* world, void* body)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    w->removeRigidBody(b);
}

extern "C" void bw_world_add_rigidbody_shadow(void* world, void* shadow)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBodyShadow* s = static_cast<bwRigidBodyShadow*>(shadow);
    w->addRigidBodyShadow(s);
}

extern "C" void bw_world_remove_rigidbody_shadow(void* world, void* shadow)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBodyShadow* s = static_cast<bwRigidBodyShadow*>(shadow);
    w->removeRigidBodyShadow(s);
}

extern "C" void bw_world_add_constraint(void* world, void* constraint, uint8_t disableCollisionsBetweenLinkedBodies)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    btTypedConstraint* c = static_cast<btTypedConstraint*>(constraint);
    w->addConstraint(c, disableCollisionsBetweenLinkedBodies);
}

extern "C" void bw_world_remove_constraint(void* world, void* constraint)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    btTypedConstraint* c = static_cast<btTypedConstraint*>(constraint);
    w->removeConstraint(c);
}

extern "C" void bw_world_make_body_kinematic(void* world, void* body)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    w->makeBodyKinematic(b);
}

extern "C" void bw_world_restore_body_dynamic(void* world, void* body)
{
    bwPhysicsWorld* w = static_cast<bwPhysicsWorld*>(world);
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    w->restoreBodyDynamic(b);
}
