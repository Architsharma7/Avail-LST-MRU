import { initialize } from "avail-js-sdk";
import { Wallet } from "ethers";

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

const config = {
  endpoint: "wss://goldberg.avail.tools/ws",
  vault: "5Gpmn9KDuWGEDmYVBeLsCHYCqqzo1ER5XirQRH6FUEDWx3s6",
};

const main = async () => {
  const api = await initialize(config.endpoint);
  await api.query.system.events(async (events) => {
    const transferEvents = [] as any;
    const remarkedEvents = [] as any;
    const matched = [] as any;

    console.log("----- Received " + events.length + " event(s): -----");
    // loop through the Vec<EventRecord>
    events.forEach(async (record) => {
      // extract the phase, event and the event types
      const { event, phase } = record;
      if (event.method === "Transfer") {
        const parsed = JSON.parse(event.data.toString());
        const from = parsed[0];
        const to = parsed[1];
        const amount = BigInt(parsed[2]);
        if (to === config.vault) {
          console.log("Money sent to vault!");
          transferEvents.push({
            from: from,
            amount: amount,
          });
        }
        console.log(transferEvents)
      } else if (event.method === "Remarked") {
        const parsed = JSON.parse(event.data.toString());

        const from = parsed[0];
        const hash = parsed[1];

        remarkedEvents.push({
          from: from,
          hash: hash,
        });
        console.log(remarkedEvents) 
      }
    });

    transferEvents.forEach((e) => {
      const remark = remarkedEvents.find((event) => event.from === e.from);
      if (remark) {
        matched.push({
          avlAddress: e.from,
          hash: remark.hash,
          amount: e.amount,
        });
      }
    });

    console.log(matched);

    if (matched.length > 0) {
      console.log("Matched a request!");
      const payload = {
        avlAddress: matched[0].avlAddress,
        amount: matched[0].amount.toString(),
        evmAddressHash: matched[0].hash,
      };
      const actionName = "bridgeAVLtoApp";
      const responseforeip = await fetch(
        `http://localhost:3001/getEIP712Types/${actionName}`
      );
      const eip712Types = (await responseforeip.json()).eip712Types;
      console.log("eiptypes", eip712Types);
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

      sendAction("bridgeAVLtoApp", body);
    }
  });
};

main();

const sendAction = async (action: string, body: any) => {
  const res = await fetch(`http://localhost:3001/${action}`, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
  console.log(`Response: ${JSON.stringify(json, null, 2)}`);
};
