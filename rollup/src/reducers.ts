import { Reducers, STF } from "@stackr/sdk/machine";
import { ERC20, BetterMerkleTree as StateWrapper } from "./state";
const { blake2AsHex } = require("@polkadot/util-crypto");
import { ZeroAddress } from "ethers";

// --------- Utilities ---------
const findIndexOfAccountERC20 = (state: StateWrapper, address: string) => {
  return state.erc20leaves.findIndex((leaf) => leaf.address === address);
};

const findIndexOfAccountBridge = (state: StateWrapper, address: string) => {
  return state.bridgeleaves.findIndex((leaf) => leaf.toaddress === address);
};

type CreateInput = {
  address: string;
};

type BaseActionInput = {
  from: string;
  to: string;
  amount: number;
};

type BridgeInput = {
  toaddress: string;
  amount: number;
  isBridged: boolean;
};

type RequestStakeAVLInput = {
  timestamp: string;
};

type FulfillStakeAVLInput = {
  avlAddress: string;
  sharesToMint: number;
};

// --------- State Transition Handlers ---------
const create: STF<ERC20, CreateInput> = {
  handler: ({ inputs, state }) => {
    const { address } = inputs;
    if (state.erc20leaves.find((leaf) => leaf.address === address)) {
      throw new Error("Account already exists");
    }
    state.erc20leaves.push({
      address,
      balance: 0,
      nonce: 0,
      allowances: [],
    });
    return state;
  },
};

const requestBridge: STF<ERC20, BridgeInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { toaddress, amount } = inputs;
    if (state.erc20leaves.find((leaf) => leaf.address !== toaddress)) {
      throw new Error("Account already exists");
    }
    if (state.erc20leaves.find((leaf) => leaf.balance < amount)) {
      throw new Error("Insufficient funds to bridge");
    }
    const indexerc20 = findIndexOfAccountERC20(state, toaddress);
    if (state.erc20leaves[indexerc20]?.address !== msgSender) {
      throw new Error("Unauthorized");
    }
    state.erc20leaves[indexerc20].balance -= amount;
    state.bridgeleaves.push({
      toaddress: toaddress,
      amount: amount,
      isBridged: false,
    });
    return state;
  },
};

const fulfillBridge: STF<ERC20, BridgeInput> = {
  handler: ({ inputs, state }) => {
    const { toaddress } = inputs;
    const indexbridge = findIndexOfAccountBridge(state, toaddress);
    state.bridgeleaves[indexbridge].isBridged = true;
    return state;
  },
};

const mint: STF<ERC20, BaseActionInput> = {
  handler: ({ inputs, state }) => {
    const { to, amount } = inputs;

    const index = findIndexOfAccountERC20(state, to);
    state.erc20leaves[index].balance += amount;
    return state;
  },
};

const burn: STF<ERC20, BaseActionInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { from, amount } = inputs;

    const index = findIndexOfAccountERC20(state, from);

    if (state.erc20leaves[index].address !== msgSender) {
      throw new Error("Unauthorized");
    }
    state.erc20leaves[index].balance -= amount;
    return state;
  },
};

const transfer: STF<ERC20, BaseActionInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { to, from, amount } = inputs;

    const fromIndex = findIndexOfAccountERC20(state, from);
    const toIndex = findIndexOfAccountERC20(state, to);

    // check if the sender is the owner of the account
    if (state.erc20leaves[fromIndex]?.address !== msgSender) {
      throw new Error("Unauthorized");
    }

    // check if the sender has enough balance
    if (state.erc20leaves[fromIndex]?.balance < inputs.amount) {
      throw new Error("Insufficient funds");
    }

    // check if to account exists
    if (!state.erc20leaves[toIndex]) {
      throw new Error("Account does not exist");
    }

    state.erc20leaves[fromIndex].balance -= amount;
    state.erc20leaves[toIndex].balance += amount;
    return state;
  },
};

const approve: STF<ERC20, BaseActionInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { from, to, amount } = inputs;

    const index = findIndexOfAccountERC20(state, from);
    if (state.erc20leaves[index].address !== msgSender) {
      throw new Error("Unauthorized");
    }

    state.erc20leaves[index].allowances.push({ address: to, amount });
    return state;
  },
};

const transferFrom: STF<ERC20, BaseActionInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { to, from, amount } = inputs;

    // check if the msgSender has enough allowance from the owner
    const toIndex = findIndexOfAccountERC20(state, to);
    const fromIndex = findIndexOfAccountERC20(state, from);

    const allowance = state.erc20leaves[fromIndex].allowances.find(
      (allowance) => allowance.address === msgSender
    );
    if (!allowance || allowance.amount < inputs.amount) {
      throw new Error("Insufficient allowance");
    }

    // check if the sender has enough balance
    if (state.erc20leaves[fromIndex].balance < inputs.amount) {
      throw new Error("Insufficient funds");
    }

    state.erc20leaves[fromIndex].balance -= amount;
    state.erc20leaves[toIndex].balance += amount;
    state.erc20leaves[fromIndex].allowances = state.erc20leaves[
      fromIndex
    ].allowances.map((allowance) => {
      if (allowance.address === msgSender) {
        allowance.amount -= amount;
      }
      return allowance;
    });
    return state;
  },
};

type BridgeAVLtoAppInput = {
  avlAddress: string;
  amount: number;
  evmAddressHash: string;
};

type ClaimAVLAccountInput = {
  avlAddress: string;
};

const bridgeAVLtoApp: STF<ERC20, BridgeAVLtoAppInput> = {
  handler: ({ inputs, state, msgSender }) => {
    // TODO: CAN ONLY BE CALLED BY OPERATOR
    const { avlAddress, amount, evmAddressHash } = inputs;

    const idx = state.avlleaves.findIndex(
      (account) => account.avlAddress === avlAddress
    );
    if (idx === -1) {
      state.avlleaves.push({
        evmAddress: "",
        avlAddress: avlAddress,
        freeBalance: amount,
        stakingShares: 0,
        evmAddressHash: evmAddressHash,
        claimed: false,
        nonce: 0,
        requestedStake: false,
      });
    } else {
      state.avlleaves[idx].freeBalance += amount;
    }

    return state;
  },
};

const claimAVLAccount: STF<ERC20, ClaimAVLAccountInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { avlAddress } = inputs;
    const idx = state.avlleaves.findIndex(
      (account) => account.avlAddress === avlAddress
    );
    if (idx === -1) {
      throw new Error("AVL ADDRESS NO EXIST");
    }

    const senderHash = blake2AsHex(msgSender as string);
    if (state.avlleaves[idx].evmAddressHash !== senderHash) {
      throw new Error("WRONG OWNER");
    }

    state.avlleaves[idx].evmAddress = msgSender as string;
    state.avlleaves[idx].claimed = true;

    return state;
  },
};

const requestStakeAVL: STF<ERC20, RequestStakeAVLInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const accountIdx = state.avlleaves.findIndex(
      (acc) => acc.evmAddress == msgSender
    );
    if (accountIdx === -1) throw new Error("requestStakeAVL: ACCOUNT INVALID");

    if (
      state.avlleaves[accountIdx].claimed === true &&
      state.avlleaves[accountIdx].requestedStake === false
    ) {
      state.avlleaves[accountIdx].requestedStake = true;
    } else {
      throw new Error("requestStakeAVL: INVALID OPERATION");
    }

    return state;
  },
};

const fulfillStakeAVL: STF<ERC20, FulfillStakeAVLInput> = {
  handler: ({ inputs, state, msgSender }) => {
    const { avlAddress, sharesToMint } = inputs;

    const accountIdx = state.avlleaves.findIndex(
      (acc) => acc.avlAddress === avlAddress
    );
    if (accountIdx === -1) {
      throw new Error("fulfillStakeAVL: ACCOUNT INVALID");
    }

    if (state.avlleaves[accountIdx].requestedStake) {
      state.avlleaves[accountIdx].freeBalance = 0;
      state.avlleaves[accountIdx].stakingShares = sharesToMint;
      state.avlleaves[accountIdx].requestedStake = false;
    } else {
      throw new Error("fulfillStakeAVL: INVALID OPERATION");
    }
    return state;
  },
};

export const reducers: Reducers<ERC20> = {
  create,
  mint,
  burn,
  transfer,
  approve,
  transferFrom,
  requestBridge,
  fulfillBridge,
  bridgeAVLtoApp,
  claimAVLAccount,
  requestStakeAVL,
  fulfillStakeAVL,
};
