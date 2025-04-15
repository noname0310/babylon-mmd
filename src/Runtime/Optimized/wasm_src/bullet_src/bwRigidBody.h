#pragma once

#include "btBulletDynamicsMinimal.h"
#include "bwMotionState.h"

class bwPhysicsWorld;

enum class bwRigidBodyConstructionInfoDataMask : uint16_t
{
    LOCAL_INERTIA = 1 << 0
};

enum class bwRigidBodyMotionType : uint8_t
{
    DYNAMIC = 0,
    STATIC = 1,
    KINEMATIC = 2
};

struct bwRigidBodyConstructionInfo final
{
    // for shape
    void* m_shape; // btCollisionShape

    // for motion state
    void* m_motionState; // bwMotionState

    // for rigid body
    uint16_t m_dataMask; // bwRigidBodyConstructionInfoDataMask
    uint8_t m_motionType; // bwRigidBodyMotionType
    float m_mass;
    btVector3 m_localInertia;
    float m_linearDamping;
    float m_angularDamping;
    float m_friction;
    // m_rollingFriction
    // m_spinningFriction
    float m_restitution;
    float m_linearSleepingThreshold;
    float m_angularSleepingThreshold;
    uint16_t m_collisionGroup;
    uint16_t m_collisionMask;
    uint8_t m_additionalDamping; // bool
    // m_additionalDampingFactor
    // m_additionalLinearDampingThresholdSqr
    // m_additionalAngularDampingThresholdSqr
    // m_additionalAngularDampingFactor
    uint8_t m_noContactResponse; // bool

    // From Bullet documentation:
    // If you plan to animate or move static objects, you should flag them as kinematic. Also disable the
    // sleeping/deactivation for them during the animation. This means Bullet dynamics world will get the
    // new worldtransform from the btMotionState every simulation frame.
    uint8_t m_disableDeactivation; // bool
};

class bwRigidBody;

class bwRigidBodyShadow final
{
private:
    bwRigidBody* m_source;
    btRigidBody m_body;

    btRigidBody::btRigidBodyConstructionInfo createRigidBodyConstructionInfo(bwRigidBody* source, bwMotionState* motionState);

public:
    bwRigidBodyShadow(bwRigidBody* source, bwMotionState* motionState);

    btRigidBody* getBody()
    {
        return &m_body;
    }

    const btRigidBody* getBody() const
    {
        return &m_body;
    }

    void setMotionState(bwMotionState* motionState)
    {
        m_body.setMotionState(motionState);
    }

    uint16_t getCollisionGroup() const;

    uint16_t getCollisionMask() const;
};

class bwRigidBody final
{
private:
    btCollisionShape* m_shape;
    bwMotionState* m_motionState;
    bwPhysicsWorld* m_world;
    btRigidBody m_body;
    uint16_t m_collisionGroup;
    uint16_t m_collisionMask;
    bwRigidBodyMotionType m_motionType;    

private:
    static btRigidBody::btRigidBodyConstructionInfo createRigidBodyConstructionInfo(bwRigidBodyConstructionInfo* info)
    {
        btCollisionShape* shape = static_cast<btCollisionShape*>(info->m_shape);
        bwMotionState* motionState = static_cast<bwMotionState*>(info->m_motionState);

        btScalar mass = 0.0f;
        if (info->m_motionType == static_cast<uint8_t>(bwRigidBodyMotionType::DYNAMIC))
        {
            mass = info->m_mass;
        }

        btVector3 localInertia(0.0f, 0.0f, 0.0f);
        if (mass != 0.0f)
        {
            if (info->m_dataMask & static_cast<uint16_t>(bwRigidBodyConstructionInfoDataMask::LOCAL_INERTIA))
            {
                localInertia = info->m_localInertia;
            }
            else
            {
                shape->calculateLocalInertia(mass, localInertia);
            }
        }

        btRigidBody::btRigidBodyConstructionInfo rbInfo(mass, motionState, shape, localInertia);
        rbInfo.m_linearDamping = info->m_linearDamping;
        rbInfo.m_angularDamping = info->m_angularDamping;
        rbInfo.m_friction = info->m_friction;
        rbInfo.m_restitution = info->m_restitution;
        rbInfo.m_additionalDamping = info->m_additionalDamping;

        return rbInfo;
    }

    // use user pointer to store bwRigidBodyShadow array
    // btAlignedObjectArray<bwRigidBodyShadow>& getShadowArray()
    // {
    //     if (m_body.getUserPointer() == nullptr)
    //     {
    //         m_body.setUserPointer(new btAlignedObjectArray<bwRigidBodyShadow>());
    //     }

    //     return *static_cast<btAlignedObjectArray<bwRigidBodyShadow>*>(m_body.getUserPointer());
    // }

public:
    bwRigidBody(bwRigidBodyConstructionInfo* info):
        m_shape(static_cast<btCollisionShape*>(info->m_shape)),
        m_motionState(static_cast<bwMotionState*>(info->m_motionState)),
        m_world(nullptr),
        m_body(createRigidBodyConstructionInfo(info)),
        m_collisionGroup(info->m_collisionGroup),
        m_collisionMask(info->m_collisionMask),
        m_motionType(static_cast<bwRigidBodyMotionType>(info->m_motionType))
    {
        m_body.setSleepingThresholds(info->m_linearSleepingThreshold, info->m_angularSleepingThreshold);
        if (info->m_disableDeactivation)
        {
            m_body.setActivationState(DISABLE_DEACTIVATION);
        }

        if (info->m_motionType == static_cast<uint8_t>(bwRigidBodyMotionType::KINEMATIC))
        {
            m_body.setCollisionFlags(m_body.getCollisionFlags() | btCollisionObject::CF_KINEMATIC_OBJECT);
        }
        else if (info->m_motionType == static_cast<uint8_t>(bwRigidBodyMotionType::STATIC))
        {
            m_body.setCollisionFlags(m_body.getCollisionFlags() | btCollisionObject::CF_STATIC_OBJECT);
        }

        if (info->m_noContactResponse)
        {
            m_body.setCollisionFlags(m_body.getCollisionFlags() | btCollisionObject::CF_NO_CONTACT_RESPONSE);
        }
    }

    bwRigidBody(bwRigidBody const&) = delete;
    bwRigidBody& operator=(bwRigidBody const&) = delete;

    ~bwRigidBody()
    {
        // btAlignedObjectArray<bwRigidBodyShadow>* ptr = static_cast<btAlignedObjectArray<bwRigidBodyShadow>*>(m_body.getUserPointer());
        // if (ptr != nullptr)
        // {
        //     delete ptr;
        // }
    }

    btRigidBody* getBody()
    {
        return &m_body;
    }

    const btRigidBody* getBody() const
    {
        return &m_body;
    }

    uint16_t getCollisionGroup() const
    {
        return m_collisionGroup;
    }

    uint16_t getCollisionMask() const
    {
        return m_collisionMask;
    }

    void setDamping(float linearDamping, float angularDamping)
    {
        m_body.setDamping(linearDamping, angularDamping);
    }

    float getLinearDamping() const
    {
        return m_body.getLinearDamping();
    }

    float getAngularDamping() const
    {
        return m_body.getAngularDamping();
    }

    void setMassProps(float mass, const float* localInertia)
    {
        if (localInertia != nullptr)
        {
            m_body.setMassProps(mass, btVector3(localInertia[0], localInertia[1], localInertia[2]));
        }
        else
        {
            m_body.setMassProps(mass, m_body.getLocalInertia());
        }
    }

    float getMass() const
    {
        return m_body.getMass();
    }

    btVector3 getLocalInertia() const
    {
        return m_body.getLocalInertia();
    }

    btVector3 getTotalForce() const
    {
        return m_body.getTotalForce();
    }

    btVector3 getTotalTorque() const
    {
        return m_body.getTotalTorque();
    }

    void applyCentralForce(const float* force)
    {
        m_body.applyCentralForce(btVector3(force[0], force[1], force[2]));
    }

    void applyTorque(const float* torque)
    {
        m_body.applyTorque(btVector3(torque[0], torque[1], torque[2]));
    }
    
    void applyForce(const float* force, const float* relativePosition)
    {
        m_body.applyForce(btVector3(force[0], force[1], force[2]), btVector3(relativePosition[0], relativePosition[1], relativePosition[2]));
    }

    void applyCentralImpulse(const float* impulse)
    {
        m_body.applyCentralImpulse(btVector3(impulse[0], impulse[1], impulse[2]));
    }

    void applyTorqueImpulse(const float* torque)
    {
        m_body.applyTorqueImpulse(btVector3(torque[0], torque[1], torque[2]));
    }

    void applyImpulse(const float* impulse, const float* relativePosition)
    {
        m_body.applyImpulse(btVector3(impulse[0], impulse[1], impulse[2]), btVector3(relativePosition[0], relativePosition[1], relativePosition[2]));
    }

    void applyPushImpulse(const float* impulse, const float* relativePosition)
    {
        m_body.applyPushImpulse(btVector3(impulse[0], impulse[1], impulse[2]), btVector3(relativePosition[0], relativePosition[1], relativePosition[2]));
    }

    btVector3 getPushVelocity() const
    {
        return m_body.getPushVelocity();
    }

    btVector3 getTurnVelocity() const
    {
        return m_body.getTurnVelocity();
    }

    void setPushVelocity(const float* velocity)
    {
        m_body.setPushVelocity(btVector3(velocity[0], velocity[1], velocity[2]));
    }

    void setTurnVelocity(const float* velocity)
    {
        m_body.setTurnVelocity(btVector3(velocity[0], velocity[1], velocity[2]));
    }

    void applyCentralPushImpulse(const float* impulse)
    {
        m_body.applyCentralPushImpulse(btVector3(impulse[0], impulse[1], impulse[2]));
    }

    void applyTorqueTurnImpulse(const float* torque)
    {
        m_body.applyTorqueTurnImpulse(btVector3(torque[0], torque[1], torque[2]));
    }

    void clearForces()
    {
        m_body.clearForces();
    }

    btVector3 getLinearVelocity() const
    {
        return m_body.getLinearVelocity();
    }

    btVector3 getAngularVelocity() const
    {
        return m_body.getAngularVelocity();
    }

    void setLinearVelocity(const float* velocity)
    {
        m_body.setLinearVelocity(btVector3(velocity[0], velocity[1], velocity[2]));
    }

    void setAngularVelocity(const float* velocity)
    {
        m_body.setAngularVelocity(btVector3(velocity[0], velocity[1], velocity[2]));
    }

    btVector3 getVelocityInLocalPoint(const float* relativePosition) const
    {
        return m_body.getVelocityInLocalPoint(btVector3(relativePosition[0], relativePosition[1], relativePosition[2]));
    }

    btVector3 getPushVelocityInLocalPoint(const float* relativePosition) const
    {
        return m_body.getPushVelocityInLocalPoint(btVector3(relativePosition[0], relativePosition[1], relativePosition[2]));
    }

    void translate(const float* translation)
    {
        m_body.translate(btVector3(translation[0], translation[1], translation[2]));
    }

    void setShape(btCollisionShape* shape);

    void setWorld(bwPhysicsWorld* world)
    {
        m_world = world;
    }

    btTransform& getWorldTransform()
    {
        return m_body.getWorldTransform();
    }

    bwRigidBodyMotionType getMotionType() const
    {
        return m_motionType;
    }

    bwRigidBodyShadow* createShadow()
    {
        // btAlignedObjectArray<bwRigidBodyShadow>& shadows = getShadowArray();
        // shadows.push_back(bwRigidBodyShadow(this));
        // return &shadows[shadows.size() - 1];
        return new bwRigidBodyShadow(this, this->m_motionState);
    }
};

bwRigidBodyShadow::bwRigidBodyShadow(bwRigidBody* source, bwMotionState* motionState) : m_source(source), m_body(createRigidBodyConstructionInfo(source, motionState))
{
    if (source->getMotionType() == bwRigidBodyMotionType::STATIC)
    {
        m_body.setCollisionFlags(m_body.getCollisionFlags() | btCollisionObject::CF_STATIC_OBJECT);
    }
    else
    {
        m_body.setCollisionFlags(m_body.getCollisionFlags() | btCollisionObject::CF_KINEMATIC_OBJECT);
        m_body.setActivationState(DISABLE_DEACTIVATION);
    }
}

btRigidBody::btRigidBodyConstructionInfo bwRigidBodyShadow::createRigidBodyConstructionInfo(bwRigidBody* source, bwMotionState* motionState)
{
    btRigidBody* sourceBody = source->getBody();
    btRigidBody::btRigidBodyConstructionInfo info(
        0.0, //sourceBody->getMass(),
        motionState,
        sourceBody->getCollisionShape(),
        btVector3(0.0, 0.0, 0.0)//sourceBody->getLocalInertia()
    );
    // because shadow is always non-dynamic we don't need to copy damping values
    // info.m_linearDamping = sourceBody->getLinearDamping();
    // info.m_angularDamping = sourceBody->getAngularDamping();
    info.m_friction = sourceBody->getFriction();
    info.m_restitution = sourceBody->getRestitution();
    // info.m_additionalDamping = sourceBody->m_additionalDamping;

    return info;
}

uint16_t bwRigidBodyShadow::getCollisionGroup() const
{
    return m_source->getCollisionGroup();
}

uint16_t bwRigidBodyShadow::getCollisionMask() const
{
    return m_source->getCollisionMask();
}

extern "C" void* bw_create_rigidbody(void* info)
{
    bwRigidBodyConstructionInfo* i = static_cast<bwRigidBodyConstructionInfo*>(info);
    bwRigidBody* body = new bwRigidBody(i);
    return body;
}

extern "C" void bw_destroy_rigidbody(void* body)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    delete b;
}

extern "C" void bw_rigidbody_set_damping(void* body, float linearDamping, float angularDamping)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setDamping(linearDamping, angularDamping);
}

extern "C" float bw_rigidbody_get_linear_damping(const void* body)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    return b->getLinearDamping();
}

extern "C" float bw_rigidbody_get_angular_damping(const void* body)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    return b->getAngularDamping();
}

extern "C" void bw_rigidbody_set_mass_props(void* body, float mass, const float* localInertia)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setMassProps(mass, localInertia);
}

extern "C" float bw_rigidbody_get_mass(const void* body)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    return b->getMass();
}

extern "C" void bw_rigidbody_get_local_inertia(const void* body, float* localInertia)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 inertia = b->getLocalInertia();
    localInertia[0] = inertia.x();
    localInertia[1] = inertia.y();
    localInertia[2] = inertia.z();
}

extern "C" void bw_rigidbody_get_total_force(const void* body, float* force)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 f = b->getTotalForce();
    force[0] = f.x();
    force[1] = f.y();
    force[2] = f.z();
}

extern "C" void bw_rigidbody_get_total_torque(const void* body, float* torque)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 t = b->getTotalTorque();
    torque[0] = t.x();
    torque[1] = t.y();
    torque[2] = t.z();
}

extern "C" void bw_rigidbody_apply_central_force(void* body, const float* force)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyCentralForce(force);
}

extern "C" void bw_rigidbody_apply_torque(void* body, const float* torque)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyTorque(torque);
}

extern "C" void bw_rigidbody_apply_force(void* body, const float* force, const float* relativePosition)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyForce(force, relativePosition);
}

extern "C" void bw_rigidbody_apply_central_impulse(void* body, const float* impulse)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyCentralImpulse(impulse);
}

extern "C" void bw_rigidbody_apply_torque_impulse(void* body, const float* torque)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyTorqueImpulse(torque);
}

extern "C" void bw_rigidbody_apply_impulse(void* body, const float* impulse, const float* relativePosition)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyImpulse(impulse, relativePosition);
}

extern "C" void bw_rigidbody_apply_push_impulse(void* body, const float* impulse, const float* relativePosition)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyPushImpulse(impulse, relativePosition);
}

extern "C" void bw_rigidbody_get_push_velocity(const void* body, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getPushVelocity();
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_get_turn_velocity(const void* body, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getTurnVelocity();
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_set_push_velocity(void* body, const float* velocity)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setPushVelocity(velocity);
}

extern "C" void bw_rigidbody_set_turn_velocity(void* body, const float* velocity)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setTurnVelocity(velocity);
}

extern "C" void bw_rigidbody_apply_central_push_impulse(void* body, const float* impulse)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyCentralPushImpulse(impulse);
}

extern "C" void bw_rigidbody_apply_torque_turn_impulse(void* body, const float* torque)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->applyTorqueTurnImpulse(torque);
}

extern "C" void bw_rigidbody_clear_forces(void* body)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->clearForces();
}

extern "C" void bw_rigidbody_get_linear_velocity(const void* body, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getLinearVelocity();
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_get_angular_velocity(const void* body, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getAngularVelocity();
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_set_linear_velocity(void* body, const float* velocity)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setLinearVelocity(velocity);
}

extern "C" void bw_rigidbody_set_angular_velocity(void* body, const float* velocity)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setAngularVelocity(velocity);
}

extern "C" void bw_rigidbody_get_velocity_in_local_point(const void* body, const float* relativePosition, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getVelocityInLocalPoint(relativePosition);
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_get_push_velocity_in_local_point(const void* body, const float* relativePosition, float* velocity)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    btVector3 v = b->getPushVelocityInLocalPoint(relativePosition);
    velocity[0] = v.x();
    velocity[1] = v.y();
    velocity[2] = v.z();
}

extern "C" void bw_rigidbody_translate(void* body, const float* translation)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->translate(translation);
}

extern "C" void bw_rigidbody_set_shape(void* body, void* shape)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    b->setShape(static_cast<btCollisionShape*>(shape));
}

extern "C" void* bw_rigidbody_get_world_transform_ptr(void* body)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    return &b->getWorldTransform();
}

extern "C" uint8_t bw_rigidbody_get_motion_type(const void* body)
{
    const bwRigidBody* b = static_cast<const bwRigidBody*>(body);
    return static_cast<uint8_t>(b->getMotionType());
}

extern "C" void* bw_create_rigidbody_shadow(void* body, void* motionState)
{
    bwRigidBody* b = static_cast<bwRigidBody*>(body);
    bwMotionState* ms = static_cast<bwMotionState*>(motionState);
    bwRigidBodyShadow* shadow = new bwRigidBodyShadow(b, ms);
    return shadow;
}

extern "C" void bw_destroy_rigidbody_shadow(void* shadow)
{
    bwRigidBodyShadow* s = static_cast<bwRigidBodyShadow*>(shadow);
    delete s;
}

extern "C" void bw_rigidbody_shadow_set_motion_state(void* shadow, void* motionState)
{
    bwRigidBodyShadow* s = static_cast<bwRigidBodyShadow*>(shadow);
    s->setMotionState(static_cast<bwMotionState*>(motionState));
}
