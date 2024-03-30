import {
  initialize,
  Keyring,
  getDecimals,
  formatNumberToBalance,
} from "avail-js-sdk"; // Global import
import { isConnected, disconnect } from "avail-js-sdk/chain"; // Modular import

import dotenv from "dotenv";

dotenv.config();

const config = {
  endpoint: "wss://goldberg.avail.tools/ws",
};

const evmAddress = "0xc43500fA76a457D0bf71BdcbDaf89b822104B094";
const FIRST_PHRASE = "quality govern kick abandon outer crouch royal acid win wait maid math"
const SECOND_PHRASE = "hunt spin sunset aerobic upgrade intact elite walnut dog pupil bridge sphere"

const main = async () => {
  const api = await initialize(config.endpoint);
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);

  const DECIMALS = await getDecimals(api);
  const keyring = await new Keyring({ type: "sr25519" });

//   if (!process.env.FIRST_PHRASE || !process.env.SECOND_PHRASE) return;
  const firstKey = await keyring.addFromUri(FIRST_PHRASE);
  const secondKey = keyring.addFromUri(FIRST_PHRASE);
  const amount = await formatNumberToBalance(2, DECIMALS)

  const txs = await [
    await api.tx.balances.transferKeepAlive(
      firstKey.address,
      amount
    ),
    api.tx.system.remarkWithEvent(evmAddress),
  ];
  console.log(txs);

  // await api.tx.balances.transferKeepAlive(secondKey.address, formatNumberToBalance(2, DECIMALS))
  //     .signAndSend(firstKey, async ({ status, events }) => {
  //         console.log("Inside the callback")
  //         await disconnect();
  //         process.exit(0);

  //     })

  // await api.tx.system.remarkWithEvent(evmAddress)

  const final = await api.tx.utility
    .batch(txs)
    .signAndSend(secondKey, async ({ status, events }) => {
      console.log("Inside the callback");
      console.log("status", status);
      await disconnect();
      process.exit(0);
    });
    console.log(final);
};

main();
