import { Wallet } from "ethers";
import axios from "axios";

const domain = {
  name: "Stackr MVP v0",
  version: "1",
  chainId: 27,
  verifyingContract: "0x6b5233e6563e50bCAbC7f321F436D3441C977C93",
  salt: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const operator = new Wallet(
  "0xd5fca1940cdcc4ee70c9a2643d0e81ca31829235d13f106b49495e8885ecd381"
);

const fulfilStakeAVL = async () => {
  const actionName = "fulfillStakeAVL";
  const response = await axios.get("http://localhost:3001/");
  const stakingData = response.data.state.avl;
  console.log("Staking data fetched:", stakingData);
  const responseforeip = await fetch(
    `http://localhost:3001/getEIP712Types/${actionName}`
  );
  const eip712Types = (await responseforeip.json()).eip712Types;
  console.log("eiptypes", eip712Types);
  if (stakingData) {
    await stakingData.forEach(async (item) => {
      if (item.requestedStake === true) {
        const payload = {
          avlAddress: item.avlAddress,
          sharesToMint: item.freeBalance,
        };
        const signature = await operator.signTypedData(
          domain,
          eip712Types,
          payload
        );
        console.log(`Signature: ${signature}`);

        const body = JSON.stringify({
          msgSender: operator.address,
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
      }
    });
  }
};

fulfilStakeAVL();
