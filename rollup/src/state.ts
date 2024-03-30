import { State } from "@stackr/sdk/machine";
import { BytesLike, ZeroHash, solidityPackedKeccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

export type ERC20Leaves = {
  address: string;
  balance: number;
  nonce: number;
  allowances: {
    address: string;
    amount: number;
  }[];
}[];

export type AVLLeaves = {
  evmAddress: string;
  avlAddress: string;
  freeBalance: number;
  stakingShares: number;
  evmAddressHash: string;
  claimed: boolean;
  nonce: number;
  requestedStake: boolean;
}[];

export type BridgeLeaves = {
  toaddress: string;
  amount: number;
  isBridged: boolean;
}[];

export type Leaves = {
  erc20: ERC20Leaves;
  bridge: BridgeLeaves;
  avl: AVLLeaves;
};

export class BetterMerkleTree {
  public merkleTreeERC20: MerkleTree;
  public merkleTreeBridge: MerkleTree;
  public erc20leaves: ERC20Leaves;
  public bridgeleaves: BridgeLeaves;
  public avlleaves: AVLLeaves;
  public merkleTreeAVL: MerkleTree;

  constructor(erc20: ERC20Leaves, bridge: BridgeLeaves, avl: AVLLeaves) {
    let { merkleTreeERC20, merkleTreeBridge, merkleTreeAVL } = this.createTree(
      erc20,
      bridge,
      avl
    );
    this.merkleTreeERC20 = merkleTreeERC20;
    this.merkleTreeBridge = merkleTreeBridge;
    this.erc20leaves = erc20;
    this.bridgeleaves = bridge;
    this.merkleTreeAVL = merkleTreeAVL;
    this.avlleaves = avl;
  }

  createTree(erc20: ERC20Leaves, bridge: BridgeLeaves, avl: AVLLeaves) {
    const hashedLeavesERC20 = erc20.map((leaf) => {
      return solidityPackedKeccak256(
        ["address", "uint256", "uint256"],
        [leaf.address, leaf.balance, leaf.nonce]
      );
    });
    let merkleTreeERC20 = new MerkleTree(
      hashedLeavesERC20,
      solidityPackedKeccak256
    );

    const hashedLeavesBridge = bridge.map((leaf) => {
      return solidityPackedKeccak256(
        ["address", "uint256", "bool"],
        [leaf.toaddress, leaf.amount, leaf.isBridged]
      );
    });
    let merkleTreeBridge = new MerkleTree(
      hashedLeavesBridge,
      solidityPackedKeccak256
    );

    const hashedLeavesAVL = avl.map((leaf) => {
      return solidityPackedKeccak256(
        [
          "address",
          "string",
          "uint256",
          "uint256",
          "string",
          "bool",
          "uint256",
          "bool"
        ],
        [
          leaf.evmAddress,
          leaf.avlAddress,
          leaf.freeBalance,
          leaf.stakingShares,
          leaf.evmAddressHash,
          leaf.claimed,
          leaf.nonce,
          leaf.requestedStake
        ]
      );
    });
    let merkleTreeAVL = new MerkleTree(
      hashedLeavesAVL,
      solidityPackedKeccak256
    );

    return { merkleTreeERC20, merkleTreeBridge, merkleTreeAVL };
  }
}

export class ERC20 extends State<Leaves, BetterMerkleTree> {
  constructor(state: Leaves) {
    super(state);
  }

  wrap(state: Leaves): BetterMerkleTree {
    const newTree = new BetterMerkleTree(state.erc20, state.bridge, state.avl);
    return newTree;
  }

  clone(): State<Leaves, BetterMerkleTree> {
    return new ERC20(this.unwrap());
  }

  unwrap(): Leaves {
    return {
      erc20: this.wrappedState.erc20leaves,
      bridge: this.wrappedState.bridgeleaves,
      avl: this.wrappedState.avlleaves,
    };
  }

  calculateRoot(): BytesLike {
    if (
      this.wrappedState.erc20leaves.length === 0 &&
      this.wrappedState.bridgeleaves.length === 0 &&
      this.wrappedState.avlleaves.length === 0 
    ) {
      return ZeroHash;
    } else if (
      this.wrappedState.erc20leaves.length !== 0 &&
      this.wrappedState.bridgeleaves.length === 0 &&
      this.wrappedState.avlleaves.length === 0
    ) {
      return this.wrappedState.merkleTreeERC20.getHexRoot();
    } else if (
      this.wrappedState.erc20leaves.length === 0 &&
      this.wrappedState.bridgeleaves.length !== 0 &&
      this.wrappedState.avlleaves.length === 0
    ) {
      return this.wrappedState.merkleTreeBridge.getHexRoot();
    } else if (
      this.wrappedState.erc20leaves.length === 0 &&
      this.wrappedState.bridgeleaves.length === 0 &&
      this.wrappedState.avlleaves.length !== 0
    ) {
      return this.wrappedState.merkleTreeAVL.getHexRoot();
    }
    const finalRoot = solidityPackedKeccak256(
      ["string", "string", "string"],
      [
        this.wrappedState.merkleTreeERC20.getHexRoot(),
        this.wrappedState.merkleTreeBridge.getHexRoot(),
        this.wrappedState.merkleTreeAVL.getHexRoot(),
      ]
    );
    return finalRoot;
    // return solidityPackedKeccak256(["string"], [JSON.stringify(this.wrappedState.erc20leaves)]);
  }
}
