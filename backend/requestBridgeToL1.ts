import { Wallet } from "ethers";
import axios from "axios";
import cors from "cors";
import { ethers } from "ethers";
import { LSTContractAddress, LSTABI } from "./constants";
import dotenv from "dotenv";

const domain = {
  name: "Stackr MVP v0",
  version: "1",
  chainId: 27,
  verifyingContract: "0x6b5233e6563e50bCAbC7f321F436D3441C977C93",
  salt: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const port = 3002;
const rollupPort = 3001;

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const walletPrivateKey = process.env.PRIVATE_KEY;
//@ts-ignore
const wallet = new ethers.Wallet(walletPrivateKey, provider);

async function createBridgeData() {
  try {
    const response = await axios.get("http://localhost:3001/");
    const stakingData = response.data.state.avl;
    const actionName = "requestBridge";
    const responseforeip = await fetch(
      `http://localhost:3001/getEIP712Types/${actionName}`
    );
    const eip712Types = (await responseforeip.json()).eip712Types;
    if (stakingData) {
      await stakingData.forEach(async (item) => {
        const payload = {
          toaddress: item.evmAddress,
          amount: item.stakingShares,
        };
        console.log("eiptypes", eip712Types);
        const signature = await wallet.signTypedData(
          domain,
          eip712Types,
          payload
        );
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
      });
    }
  } catch (error) {
    console.log(error);
  }
}

createBridgeData();