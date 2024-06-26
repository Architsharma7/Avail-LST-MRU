import axios from "axios";
import cors from "cors";
import { ethers } from "ethers";
import { LSTContractAddress, LSTABI } from "./constants";
import dotenv from "dotenv";

type BridgeLeaves = {
  toaddress: string;
  amount: number;
  isBridged: boolean;
};

// const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const provider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/ba8a3893f5f34779b1ea295f176a73c6"
);
// const walletPrivateKey = process.env.PRIVATE_KEY;
const walletPrivateKey =
  "";
//@ts-ignore
const wallet = new ethers.Wallet(walletPrivateKey, provider);
const erc20Contract = new ethers.Contract(LSTContractAddress, LSTABI, wallet);

const domain = {
  name: "Stackr MVP v0",
  version: "1",
  chainId: 27,
  verifyingContract: "0x6b5233e6563e50bCAbC7f321F436D3441C977C93",
  salt: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

async function updateRollupState(bridge: BridgeLeaves) {
  try {
    const actionName = "fulfillBridge";
    const responseforeip = await fetch(
      `http://localhost:3001/getEIP712Types/${actionName}`
    );
    const eip712Types = (await responseforeip.json()).eip712Types;
    const payload = { ...bridge };
    console.log("eiptypes", eip712Types);
    const signature = await wallet.signTypedData(domain, eip712Types, payload);
    console.log(`Signature: ${signature}`);

    const body = JSON.stringify({
      msgSender: wallet.address,
      signature: signature,
      payload: payload,
    });

    const res = await fetch(`http://localhost:3001/${actionName}`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await res.json();
    console.log(`Response: ${JSON.stringify(json, null, 2)}`);
  } catch (error) {
    console.log(error);
  }
}

async function mintTokens(toAddress: string, amount: number) {
  let _amount = BigInt(amount);
  console.log("amount", amount);

  try {
    const tx = await erc20Contract.mint(toAddress, _amount);
    console.log(tx);
    const receipt = await tx.wait();
    console.log(receipt);
    console.log("Tokens minted successfully.");
  } catch (error) {
    console.error("Error minting tokens:", error);
  }
}

const fulfilBridgeToL1 = async () => {
  try {
    const response = await axios.get("http://localhost:3001/");
    const avlData = response.data.state.avl;
    console.log("Bridge data fetched:", avlData);
    const bridgeData = response.data.state.bridge;
    console.log("Bridge data fetched:", bridgeData);
    // TODO: Fix this
    if (avlData) {
      await avlData.forEach(async (item) => {
        console.log(item);
        // this is not the right way of passing the amount, there might be multiple objects in avl and bridge
        await mintTokens(item.evmAddress, bridgeData[0].amount);
        await updateRollupState({
          toaddress: item.evmAddress,
          amount: item.stakingShares,
          isBridged: false,
        });
      });
    }
  } catch (error) {
    console.log(error);
  }
};

fulfilBridgeToL1();
