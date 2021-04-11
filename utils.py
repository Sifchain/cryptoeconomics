def getUserAccReward(data, addressOfInterest):
    """
    A wrapper that processes data and gets user's accumulated reward
    args:
        data: raw data
        addressOfInterest: address of interest
    requires:
        the following functions
    returns:
        reserved: reward already set aside for the user, ready to be claimed any time (in ROWAN)
        claimable: user's accumulated *unclaimed* reward (in ROWAN)
        currentMultiplier: user's current multiplier
    """
    # constants
    constants = {'miningSeconds':121*86400, # 121 days
                 'totalReward':30e6, # 30M
                 'epochSeconds':200*60, # 200 minutes
                 'multiplierSeconds': 121*86400, # 121 days
                 'multiplierBand': [1,4], # from 1x to 4x
                 'isGeyser': False} # Geyser or not
    # data route
    data = data['data']['snapshots_new'][0]['snapshot_data']

    def dict2list(d: dict):
        """convert a dictionary to a list"""
        l = []
        for k, v in d.items():
            l.append(v)
        return l

    def elementwisesum(listoflists):
        """element-wise summation of lists"""
        return [sum(x) for x in zip(*listoflists)]

    def calculate_accumulated_reward(userSnapshots, list_userSnapshots, **kwargs):
        """
        Get user's accumulated reward
        args:
            userSnapshots: a list of user's provided liquidity at diff snapshots (in ROWAN)
            list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
        kwargs:
            miningSeconds: the period of the liquidity mining programme (in seconds)
            totalReward: total rewards to be distributed (in ROWAN)
            epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
            isGeyser: Geyser (=True) or normal (=False) liquidity mining (bool)
        requires:
            get_normal_accmulated_reward()
            get_geyser_accmulated_reward()
        returns:
            userAccReward: user's accumulated reward (in ROWAN)
        """
        def get_normal_accmulated_reward(userSnapshots, list_userSnapshots, **kwargs):
            """
            Get user's accumulated reward under normal liquidity mining
            args:
                userSnapshots: a list of user's provided liquidity at diff snapshots (in ROWAN)
                list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
            kwargs:
                miningSeconds: the period of the liquidity mining programme (in seconds)
                totalReward: total rewards to be distributed (in ROWAN)
                epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
            requires:
                elementwisesum()
            returns:
                userAccReward: user's accumulated reward (in ROWAN)
            """
            globalSnapshots = elementwisesum(list_userSnapshots)
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
                userSnapshots: a list of user's liquidity provided at diff snapshots (in ROWAN)
                list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
            kwargs:
                miningSeconds: the period of the liquidity mining programme (in seconds)
                totalReward: total number of rewards to be distributed
                epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
            requires:
                get_userEpochsSnapshots()
                get_globalEpochsSnapshots()
                get_normal_accmulated_reward()
            returns:
                userAccReward: user's accumulated reward
            """

            def get_userEpochsSnapshots(userSnapshots):
                """
                Convert userSnapshots into userEpochsSnapshots for Geyser calculation
                args:
                    userSnapshots: a list of user's provided liquidity at diff snapshots (in USD)
                returns:
                    userEpochsSnapshots: a list of user's liquidity-epochs provided at diff snapshots (in USD-snapshot)
                """
                # initialise
                user_memory = []
                userEpochsSnapshots = []

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
                    userEpochsSnapshots.append(sum([(i-mem[0]+1)*mem[1] for mem in user_memory]))
                return userEpochsSnapshots

            def get_globalEpochsSnapshots(list_userSnapshots):
                """
                Compute globalEpochsSnapshots from a list of userSnapshots
                args:
                    list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
                requires:
                    elementwisesum()
                returns:
                    globalEpochsSnapshots: a list of global total liquidity-epochs (liquidity-seconds) provided at diff snapshots (in ROWAN)
                """
                list_userEpochsSnapshots = []
                for l in list_userSnapshots:
                    list_userEpochsSnapshots.append(get_userEpochsSnapshots(l))
                globalEpochsSnapshots = elementwisesum(list_userEpochsSnapshots)
                return globalEpochsSnapshots

            userAccReward = get_normal_accmulated_reward(userSnapshots=get_userEpochsSnapshots(userSnapshots),
                                                         globalSnapshots=get_globalEpochsSnapshots(list_userSnapshots),
                                                         **kwargs)
            return userAccReward

        isGeyser = kwargs['isGeyser']
        assert type(isGeyser) == bool, 'isGeyser should be boolean'
        if isGeyser:
            return get_geyser_accmulated_reward(userSnapshots, list_userSnapshots, **kwargs)
        else:
            return get_normal_accmulated_reward(userSnapshots, list_userSnapshots, **kwargs)

    def get_multiplier_record(userSnapshots, **kwargs):
        """
        Get user's multiplier record for all snapshots
        args:
            userSnapshots: a list of user's liquidity provided at diff snapshots
        kwargs:
            multiplierSeconds: the period of reaching max multiplier (in seconds)
            epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
            multiplierBand: min and max multiplier (list with length of 2)
        returns:
            multiplier_record: user's multiplier record
        """
        def compute_multiplier(oldSnapshot, newSnapshot, oldMultiplier=0, **kwargs):
            multiplierSeconds, epochSeconds, multiplierBand = kwargs['multiplierSeconds'], kwargs['epochSeconds'], kwargs['multiplierBand']

            assert oldSnapshot >= 0, 'oldSnapshot is negative'
            assert newSnapshot >= 0, 'newSnapshot is negative'
            assert oldMultiplier == 0 or multiplierBand[0] <= oldMultiplier <= multiplierBand[1], 'invalid oldMultiplier'

            if newSnapshot == 0: # if no liquidity
                return 0
            elif newSnapshot-oldSnapshot > 0 and oldMultiplier == 0: # just added liquidity from none
                return multiplierBand[0]
            elif newSnapshot-oldSnapshot < 0: # just removed some (not all) liquidity
                return multiplierBand[0]
            else:
                multiplierIncrement = (multiplierBand[1]-multiplierBand[0]) / multiplierSeconds * epochSeconds
                return min(multiplierBand[1], oldMultiplier + multiplierIncrement)

        multiplier_record = []
        for i in range(len(userSnapshots)):
            if i == 0:
                multiplier = compute_multiplier(0, userSnapshots[i], oldMultiplier=0, **kwargs)
            else:
                multiplier = compute_multiplier(userSnapshots[i-1], userSnapshots[i], oldMultiplier=multiplier, **kwargs)
            multiplier_record.append(multiplier)

        assert len(multiplier_record) == len(userSnapshots), 'Wrong length for multiplier_record'
        return multiplier_record

    import numpy as np

    # for quick access
    addressList = list(data)
    tokenList = list(data[addressList[0]])

    # sanity check so that tokenList is universal
    for addy in addressList:
        assert tokenList == list(data[addy]), 'wrong token list'

    # convert events into snapshots
    snapshot = {} #
    for addy in addressList: # for each addy
        snapshotOfOneAddress = 0
        for token in tokenList: # aggregate USD values across all tokens
            snapshotOfOneAddress += np.cumsum(data[addy][token], dtype=float)# cumulative sum
        snapshot[addy] = snapshotOfOneAddress

    # turn all negative numbers to 0
    for addy, l in snapshot.items():
        snapshot[addy] = [max(0,e) for e in l]

    list_userSnapshots = dict2list(snapshot)
    globalSnapshots = elementwisesum(list_userSnapshots)

    # establish a user profile
    profile = {'liquidity':snapshot[addressOfInterest],
               'reward':{'reserved':0, 'burned':0}}
    profile['multiplier'] = get_multiplier_record(userSnapshots=profile['liquidity'],
                                                  **constants)

    for i in range(1, len(profile['multiplier'])):

        if  profile['multiplier'][i-1] > profile['multiplier'][i]: # if multiplier is going down, a claim is triggered
            userAccRewardSoFar = calculate_accumulated_reward(userSnapshots=profile['liquidity'][:i],
                                                              list_userSnapshots=[l[:i] for l in list_userSnapshots],
                                                              **constants)

            profile['reward']['reserved'] += (userAccRewardSoFar - profile['reward']['burned']) * profile['multiplier'][i-1] / constants['multiplierBand'][1]
            profile['reward']['burned'] = userAccRewardSoFar

    userAccRewardSoFar = calculate_accumulated_reward(userSnapshots=profile['liquidity'],
                                                      list_userSnapshots=list_userSnapshots,
                                                      **constants)
    profile['reward']['claimable'] = (userAccRewardSoFar - profile['reward']['burned']) * profile['multiplier'][-1] / constants['multiplierBand'][1]

    return profile['reward']['reserved'], profile['reward']['claimable'], profile['multiplier'][-1]


def inspect_address(data, address, filtering=False, detail=True):
    """
    Debug tool, not needed for deployment
    Inspect the activities of anddress
    args:
        data: raw data
        address: address of interest
        filtering: if True, only select addresses that removes liq before adding any (default False)
        detail: if True, print out human-readable detail
    """
    d = data[address]
    tokenList = list(d)

    if filtering:
        i = 0
        while len(d[tokenList[0]]) > i:
            min_, max_ = 0, 0
            for token in tokenList:
                min_ = min(min_, d[token][i])
                max_ = max(max_, d[token][i])

            if min_ < 0 and max_ <= 0:
                break
            elif max_ > 0:
                return None
            i += 1

        print(address)
    i = 0
    while len(d[tokenList[0]]) > i:
        for token in tokenList:
            if d[token][i] != 0:
                if detail:
                    print(i, token, d[token][i])
        i += 1
    if detail:
        print()
