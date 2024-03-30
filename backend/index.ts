const express = require("express");
const app = express();
import axios from "axios";
import cors from "cors";
import { ethers } from "ethers";
import { LSTContractAddress, LSTABI } from "./constants";

const port = 3002;
const rollupPort = 3001;
app.use(cors());

type BridgeLeaves = {
  toaddress: string;
  amount: number;
  isBridged: boolean;
};

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const walletPrivateKey = process.env.PRIVATE_KEY;
//@ts-ignore
const wallet = new ethers.Wallet(walletPrivateKey, provider);
const erc20Contract = new ethers.Contract(LSTContractAddress, LSTABI, wallet);

let bridgeData = null;

async function checkServerAvailability() {
  try {
    const response = await axios.get("http://localhost:3001/");
    if (response.status === 200) {
      startPolling();
    } else {
      console.error("Server is not running or returned an error.");
    }
  } catch (error) {
    console.error("Error checking server availability");
  }
}

const fetchBridgeData = async () => {
  try {
    const response = await axios.get("http://localhost:3001/");
    bridgeData = response.data.state.bridge;
    console.log("Bridge data fetched:", bridgeData);
    if (bridgeData) {
      //@ts-ignore
      const unbridgedObjects = bridgeData?.filter(
        (obj: any) => obj.isBridged === false
      );
      console.log("Unbridged objects:", unbridgedObjects);
      await unbridgedObjects.forEach(async (item: BridgeLeaves) => {
        if (item.isBridged === false) {
          await mintTokens(item.toaddress, item.amount);
          await updateRollupState({
            toaddress: item.toaddress,
            amount: item.amount,
            isBridged: false,
          });
        }
      });
    }
  } catch (error) {
    console.log(error);
  }
};

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
    // const response = await axios.post(`http://localhost:3001/fulfillBridge`, {
    //   msgSender: wallet.address,
    //   signature: signature,
    //   payload: { toaddress: toAddress },
    // });
    // console.log("Rollup state updated successfully:", response.data);

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

function startPolling() {
  const pollingInterval = 10000;
  const pollingTimer = setInterval(fetchBridgeData, pollingInterval);
}

async function mintTokens(toAddress: string, amount: number) {
  let _amount = BigInt(amount);
  _amount = _amount * BigInt(10 ** 18);

  try {
    const tx = await erc20Contract.mint(toAddress, _amount);
    await tx.wait();
    console.log("Tokens minted successfully.");
  } catch (error) {
    console.error("Error minting tokens:", error);
  }
}

checkServerAvailability();

app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});
