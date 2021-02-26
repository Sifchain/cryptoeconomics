def get_APY(totalStaked, **kwargs):
    """
    Get live APY
    args:
        totalStaked: global total liquidity staked (in ROWAN)
    kwargs:
        miningSeconds: the period of the liquidity mining programme (in seconds)
        totalReward: total number of rewards to be distributed
    returns:
        apy: marginal APY
    """
    miningSeconds, totalReward = kwargs['miningSeconds'], kwargs['totalReward']
    
    if totalStaked > 0: # prevent edge case
        apy = totalReward \
            / totalStaked \
            * 365 * 86400 / miningSeconds \
            * 100
    else:
        apy = 1e9 # show an insanely high APY when no one is providing liquidity
    return apy


def get_normal_accmulated_reward(userSnapshots, globalSnapshots, **kwargs):
    """
    Get user's accumulated reward under normal liquidity mining
    args:
        userSnapshots: a list of user's liquidity staked at diff snapshots (in ROWAN)
        globalSnapshots: a list of global total liquidity staked at diff snapshots (in ROWAN)
    kwargs:
        miningSeconds: the period of the liquidity mining programme (in seconds)
        totalReward: total number of rewards to be distributed
        epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
    returns:
        userAccReward: user's accumulated reward
    """
    
    assert len(userSnapshots) == len(globalSnapshots), 'Lists have different lengths'
    miningSeconds, totalReward, epochSeconds = kwargs['miningSeconds'], kwargs['totalReward'], kwargs['epochSeconds']
    # total reward distributed per epoch
    totalRewardPerEpoch = totalReward / miningSeconds * epochSeconds
    
    # sum(reward distributed pro-rata at each epoch)
    userAccReward = sum([userStaked / globalStaked * totalRewardPerEpoch for userStaked, globalStaked in zip(userSnapshots, globalSnapshots)])
    return userAccReward


def get_geyser_accmulated_reward(userSnapshots, list_userSnapshots, **kwargs):
    """
    Get user's accumulated reward under geyser liquidity mining
    args:
        userSnapshots: a list of user's liquidity staked at diff snapshots (in ROWAN)
        list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
    kwargs:
        miningSeconds: the period of the liquidity mining programme (in seconds)
        totalReward: total number of rewards to be distributed
        epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
    requires:
        get_userSecondsSnapshots()
        get_globalSecondsSnapshots()
    returns:
        userAccReward: user's accumulated reward
    """
    
    def get_userSecondsSnapshots(userSnapshots):
        """
        Convert userSnapshots into userSecondsSnapshots for Geyser calculation
        args:
            userSnapshots: a list of user's liquidity staked at diff snapshots (in ROWAN)
        returns:
            userSecondsSnapshots: a list of user's liquidity-epochs (liquidity-seconds) staked at diff snapshots (in ROWAN)
        """
        # initialise
        user_memory = [] 
        userSecondsSnapshots = []

        for i in range(len(userSnapshots)):
            if userSnapshots[i] == 0: # if none staked at snapshot
                user_memory = [] # clear memory
            else: # if some staked at snapshot
                # get the difference between the previous snapshot
                if i == 0:
                    diff = userSnapshots[0]
                else:
                    diff = userSnapshots[i] - userSnapshots[i-1]

                if diff > 0: # if more tokens are staked
                    user_memory.append((i,diff)) # record (index, difference in staked token)
                elif diff < 0: # if some tokens are withdrawn
                    deficit = -diff
                    while deficit > 0:
                        if user_memory[-1][-1] > deficit: # partial remove
                            user_memory[-1] = (user_memory[-1][0], user_memory[-1][-1]-deficit)
                            deficit = 0
                        else:
                            deficit -= user_memory[-1][-1]
                            user_memory = user_memory[:-1]
            userSecondsSnapshots.append(sum([(i-mem[0]+1)*mem[1] for mem in user_memory]))
        return userSecondsSnapshots
    
    def get_globalSecondsSnapshots(list_userSnapshots):
        """
        Compute globalSecondsSnapshots from a list of userSnapshots
        args:
            list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
        requires:
            elementwisesum()
        returns:
            globalSecondsSnapshots: a list of global total liquidity-epochs (liquidity-seconds) staked at diff snapshots (in ROWAN)
        """
     
        list_userSecondsSnapshots = []
        for l in list_userSnapshots:
            list_userSecondsSnapshots.append(get_userSecondsSnapshots(l))
        globalSecondsSnapshots = elementwisesum(list_userSecondsSnapshots)
        return globalSecondsSnapshots
    
    userAccReward = get_normal_accmulated_reward(userSnapshots=get_userSecondsSnapshots(userSnapshots), 
                                                 globalSnapshots=get_globalSecondsSnapshots(list_userSnapshots), 
                                                 **kwargs)
    return userAccReward

def elementwisesum(listoflists):
    """element-wise summation of lists"""
    return [sum(x) for x in zip(*listoflists)]