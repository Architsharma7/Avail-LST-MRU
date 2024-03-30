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

export type BridgeLeaves = {
  toaddress: string;
  amount: number;
  isBridged: boolean;
}[];

export type Leaves = {
  erc20: ERC20Leaves;
  bridge: BridgeLeaves;
};

export class BetterMerkleTree {
  public merkleTreeERC20: MerkleTree;
  public merkleTreeBridge: MerkleTree;
  public erc20leaves: ERC20Leaves;
  public bridgeleaves: BridgeLeaves;

  constructor(erc20: ERC20Leaves, bridge: BridgeLeaves) {
    let { merkleTreeERC20, merkleTreeBridge } = this.createTree(erc20, bridge);
    this.merkleTreeERC20 = merkleTreeERC20;
    this.merkleTreeBridge = merkleTreeBridge;
    this.erc20leaves = erc20;
    this.bridgeleaves = bridge;
  }

  createTree(erc20: ERC20Leaves, bridge: BridgeLeaves) {
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

    return { merkleTreeERC20, merkleTreeBridge };
  }
}

export class ERC20 extends State<Leaves, BetterMerkleTree> {
  constructor(state: Leaves) {
    super(state);
  }

  wrap(state: Leaves): BetterMerkleTree {
    const newTree = new BetterMerkleTree(state.erc20, state.bridge);
    return newTree;
  }

  clone(): State<Leaves, BetterMerkleTree> {
    return new ERC20(this.unwrap());
  }

  unwrap(): Leaves {
    return {
      erc20: this.wrappedState.erc20leaves,
      bridge: this.wrappedState.bridgeleaves,
    };
  }

  calculateRoot(): BytesLike {
    if (
      this.wrappedState.erc20leaves.length === 0 &&
      this.wrappedState.bridgeleaves.length === 0
    ) {
      return ZeroHash;
    } else if (
      this.wrappedState.erc20leaves.length !== 0 &&
      this.wrappedState.bridgeleaves.length === 0
    ) {
      return this.wrappedState.merkleTreeERC20.getHexRoot();
    } else if (
      this.wrappedState.erc20leaves.length === 0 &&
      this.wrappedState.bridgeleaves.length !== 0
    ) {
      return this.wrappedState.merkleTreeBridge.getHexRoot();
    }
    const finalRoot = solidityPackedKeccak256(
      ["string", "string"],
      [
        this.wrappedState.merkleTreeERC20.getHexRoot(),
        this.wrappedState.merkleTreeBridge.getHexRoot(),
      ]
    );
    return finalRoot;
  }
}
