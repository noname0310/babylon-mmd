#pragma once

#include "btBulletDynamicsMinimal.h"

ATTRIBUTE_ALIGNED16(struct)
bwMotionState final : public btMotionState
{
	btTransform m_graphicsWorldTrans;
	// btTransform m_startWorldTrans;

	BT_DECLARE_ALIGNED_ALLOCATOR();

	bwMotionState(const btTransform& startTrans = btTransform::getIdentity())
		: m_graphicsWorldTrans(startTrans)
		//   m_startWorldTrans(startTrans)
	{
	}

	///synchronizes world transform from user to physics
	virtual void getWorldTransform(btTransform& centerOfMassWorldTrans) const
	{
		centerOfMassWorldTrans = m_graphicsWorldTrans;
	}

	///synchronizes world transform from physics to user
	///Bullet only calls the update of worldtransform for active objects
	virtual void setWorldTransform(const btTransform& centerOfMassWorldTrans)
	{
		m_graphicsWorldTrans = centerOfMassWorldTrans;
	}
};

class bwMotionStateBundle final
{
private:
    bwMotionState* m_motionStates;
	size_t m_count;

public:
	bwMotionStateBundle(size_t count)
	{
		m_motionStates = new bwMotionState[count];
		m_count = count;
	}

	bwMotionStateBundle(const bwMotionStateBundle&) = delete;
	bwMotionStateBundle& operator=(const bwMotionStateBundle&) = delete;

	~bwMotionStateBundle()
	{
		delete[] m_motionStates;
	}

	btMotionState* getMotionStatesPtr()
	{
		return m_motionStates;
	}

	btMotionState& getMotionState(size_t index)
	{
		return m_motionStates[index];
	}

	size_t getCount() const
	{
		return m_count;
	}
};

extern "C" void* bw_create_motion_state(float* transformBuffer)
{
    btTransform transform;
    transform.setFromOpenGLMatrix(transformBuffer);
    bwMotionState* motionState = new bwMotionState(transform);
    return motionState;
}

extern "C" void bw_destroy_motion_state(void* motionState)
{
	bwMotionState* m = static_cast<bwMotionState*>(motionState);
	delete m;
}

extern "C" void* bw_create_motion_state_bundle(size_t count)
{
	bwMotionStateBundle* bundle = new bwMotionStateBundle(count);
	return bundle;
}

extern "C" void bw_destroy_motion_state_bundle(void* bundle)
{
	bwMotionStateBundle* b = static_cast<bwMotionStateBundle*>(bundle);
	delete b;
}

extern "C" void* bw_motion_state_bundle_get_motion_states_ptr(void* bundle)
{
	bwMotionStateBundle* b = static_cast<bwMotionStateBundle*>(bundle);
	return b->getMotionStatesPtr();
}

extern "C" size_t bw_motion_state_bundle_get_count(void* bundle)
{
	bwMotionStateBundle* b = static_cast<bwMotionStateBundle*>(bundle);
	return b->getCount();
}
