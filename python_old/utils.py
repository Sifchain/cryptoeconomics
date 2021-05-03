def getUserAccReward(data: dict,
                     addressOfInterest: str,
                     isValidator: bool = False,
                     hasPoolBalance: bool = True,
                     **kwargs):
    """
    A wrapper that processes data and gets user's accumulated reward
    args:
        data: raw data
        addressOfInterest: address of interest (str)
        isValidator: validator subsidy (True) or liquidity mining (False) (bool)
        hasPoolBalance: whether the user still has liquidity provided (default True) (bool)
        kwargs: [Optional] params in constants that need overriding (dict)
    requires:
        the following functions
    returns:
        claimable: reward already set aside for the user, ready to be claimed any time (in ROWAN)
        accumulated: user's accumulated *unclaimed* reward (in ROWAN)
        currentMultiplier: user's current multiplier
    """
    # constants
    constants = {'miningSeconds':121*86400, # 121 days
                 'totalReward':30e6, # 30M
                 'epochSeconds':200*60, # 200 minutes
                 'multiplierSeconds': 121*86400, # 121 days
                 'multiplierBand': [1,4], # from 1x to 4x
                 'isGeyser': True} # Geyser or not
    for k, v in kwargs.items(): # override if user specified
        assert k in list(constants), 'param does not exist'
        constants[k] = v
    # data route
    if isValidator:
        data = data['data']['snapshots_validators'][0]['snapshot_data']
    else:
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
            def get_reward_per_snapshot(**kwargs):
                """
                Get the global reward rate for each snapshot
                kwargs:
                    miningSeconds: the period of the liquidity mining programme (in seconds)
                    totalReward: total rewards to be distributed (in ROWAN)
                    epochSeconds: the period of an epoch (in seconds) as we take a snapshot per epoch
                returns:
                    rewardSnapshots: a list of number of rewards (in ROWAN) to be distributed for each snapshot
                """
                miningSeconds, totalReward, epochSeconds = kwargs['miningSeconds'], kwargs['totalReward'], kwargs['epochSeconds']
                maxSnapshotLength = int(miningSeconds/epochSeconds) # round down

                # a bodge to alleviate the inequality in reward distribution caused by sudden spike in liquidity add
                if isValidator:
                    assert epochSeconds == 200*60, 'This bodge only works when epochSeconds == 200*60'
                    liquidityWeightQuantized = [0,1,2,3,4,5]
                    liquidityWeightSnapshotIndex = [0,60,88,119,270,372,maxSnapshotLength]
                else:
                    assert epochSeconds == 200*60, 'This bodge only works when epochSeconds == 200*60'
                    liquidityWeightQuantized = [0,1,4,5]
                    liquidityWeightSnapshotIndex = [0,40,44,71,maxSnapshotLength]

                assert len(liquidityWeightQuantized)+1 == len(liquidityWeightSnapshotIndex), 'liquidityWeightQuantized or liquidityWeightSnapshotIndex is invalid'
                rewardSnapshots = []
                for weight, lowerlim, upperlim in zip(liquidityWeightQuantized, liquidityWeightSnapshotIndex[:-1], liquidityWeightSnapshotIndex[1:]):
                    rewardSnapshots.extend([weight] * (upperlim-lowerlim))
                rewardSnapshots = [r/sum(rewardSnapshots)*totalReward for r in rewardSnapshots] # normalise
                return rewardSnapshots

            globalSnapshots = elementwisesum(list_userSnapshots)
            assert len(userSnapshots) == len(globalSnapshots), 'Lists have different lengths'

            rewardSnapshots = get_reward_per_snapshot(**kwargs)
            rewardSnapshots = rewardSnapshots[:len(userSnapshots)] # trim to ignore reward allocation for future snapshots
            userAccReward = sum([userStaked / globalStaked * reward if globalStaked > 0 else 0 for userStaked, globalStaked, reward in zip(userSnapshots, globalSnapshots, rewardSnapshots)])
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

            def get_list_userEpochsSnapshots(list_userSnapshots):
                """
                Compute globalEpochsSnapshots from a list of userSnapshots
                args:
                    list_userSnapshots: a FULL list of userSnapshots (must include all users to capture the global state)
                requires:
                    elementwisesum()
                returns:
                    list_userEpochsSnapshots: a list of userEpochsSnapshots
                """
                list_userEpochsSnapshots = []
                for l in list_userSnapshots:
                    list_userEpochsSnapshots.append(get_userEpochsSnapshots(l))
                return list_userEpochsSnapshots

            userAccReward = get_normal_accmulated_reward(userSnapshots=get_userEpochsSnapshots(userSnapshots),
                                                         list_userSnapshots=get_list_userEpochsSnapshots(list_userSnapshots),
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
    def get_ignore_address_list():
        """
        Get a list of addresses that should be ignored in reward calculation
        These addresses belong to the Sifchain foundation
        returns:
            ignoredAddressList: a list of ignored addresses
        """
        return ['sif1vktf7skpeyc3mq8fdg59nyyg57a053p9n3l5dl',
                'sif1cvqeau8z7um5vnl78ueqyvfl26jcjpunmejdyz',
                'sif1fy8xewt2xkyrnym2x36qfzwrtqf3z40cdzxgxz',
                'sif1kxyjwd9clrnntuxdrtejwdrgvatarftzp8d8ps',
                'sif1gaej9rvg99xnn8zecznj2vf2tnf87gx60hdkja',
                'sif12ffxzle0x5093ysnpatrjy7rsduj2u2v4zygh9',
                'sif165f2082xga5a3chux9lcf97ty9fa9jfdwes5cz',
                'sif1reedn7lzr06smmckgn52mpppca3aeprasfvcf5']

    import numpy as np

    # for quick access
    addressList = list(data)
    tokenList = list(data[addressList[0]])

    # sanity check so that tokenList is universal
    for addy in addressList:
        assert tokenList == list(data[addy]), 'wrong token list'

    # if not on the list -> returns all zeros
    ignoredAddressList = get_ignore_address_list()
    if addressOfInterest not in addressList or addressOfInterest in ignoredAddressList:
        return 0, 0, 0

    # convert events into snapshots
    snapshot = {} #

    for addy in addressList: # for each addy
        if addy not in ignoredAddressList: # if not ignored
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
               'reward':{'claimable':0, 'burned':0}}
    profile['multiplier'] = get_multiplier_record(userSnapshots=profile['liquidity'],
                                                  **constants)

    for i in range(1, len(profile['multiplier'])):

        if  profile['multiplier'][i-1] > profile['multiplier'][i]: # if multiplier is going down, a claim is triggered
            userAccRewardSoFar = calculate_accumulated_reward(userSnapshots=profile['liquidity'][:i],
                                                              list_userSnapshots=[l[:i] for l in list_userSnapshots],
                                                              **constants)

            profile['reward']['claimable'] += (userAccRewardSoFar - profile['reward']['burned']) * profile['multiplier'][i-1] / constants['multiplierBand'][1]
            profile['reward']['burned'] = userAccRewardSoFar

    userAccRewardSoFar = calculate_accumulated_reward(userSnapshots=profile['liquidity'],
                                                      list_userSnapshots=list_userSnapshots,
                                                      **constants)
    profile['reward']['accumulated'] = (userAccRewardSoFar - profile['reward']['burned']) * profile['multiplier'][-1] / constants['multiplierBand'][1]

    if hasPoolBalance:
        return profile['reward']['claimable'], profile['reward']['accumulated'], profile['multiplier'][-1]
    else:
        return profile['reward']['claimable'], 0, 0

def inspect_address(data, address, isValidator=False, filtering=False, detail=True):
    """
    Debug tool, not needed for deployment
    Inspect the activities of anddress
    args:
        data: raw data
        address: address of interest
        filtering: if True, only select addresses that removes liq before adding any (default False)
        detail: if True, print out human-readable detail
    """
    # data route
    if isValidator:
        data = data['data']['snapshots_validators'][0]['snapshot_data']
    else:
        data = data['data']['snapshots_new'][0]['snapshot_data']

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

def remove_header(filename):
    """
    Data processing tool, not needed for deployment
    Remove header of a file so that "{" is the first char
    args:
        filename: file name (str)
    """
    with open(filename, 'r') as f:
        text = f.read()
    with open(filename, 'w') as f:
        f.write(text[text.find('{'):])
