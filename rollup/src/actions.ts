import { ActionSchema, SolidityType } from "@stackr/sdk";

// utility function to create a transfer schema
function generateSchemaFromBase(name: string) {
  return new ActionSchema(name, {
    to: SolidityType.ADDRESS,
    from: SolidityType.ADDRESS,
    amount: SolidityType.UINT,
  });
}

// createAccountSchema is a schema for creating an account
export const createAccountSchema = new ActionSchema("createAccount", {
  address: SolidityType.ADDRESS,
});

export const bridgeTokenSchema = new ActionSchema("bridgeToken", {
  toaddress: SolidityType.ADDRESS,
  amount: SolidityType.UINT,
  isBridged: SolidityType.BOOL,
});

export const bridgeAVLtoAppSchema = new ActionSchema("bridgeAVLtoApp", {
  avlAddress: SolidityType.STRING,
  amount: SolidityType.UINT,
  evmAddressHash: SolidityType.STRING
});

export const claimAVLAccountSchema = new ActionSchema("claimAVLAccount", {
  avlAddress: SolidityType.STRING
})

export const requestStakeAVLSchema = new ActionSchema("StakeAVL", {
  timestamp: SolidityType.STRING
})

// transferSchema is a collection of all the transfer actions
// that can be performed on the rollup
export const schemas = {
  create: createAccountSchema,
  transfer: generateSchemaFromBase("transfer"),
  transferFrom: generateSchemaFromBase("transferFrom"),
  mint: generateSchemaFromBase("mint"),
  burn: generateSchemaFromBase("burn"),
  approve: generateSchemaFromBase("approve"),
  requestBridge: bridgeTokenSchema,
  fulfillBridge: bridgeTokenSchema,
  bridgeAVLtoApp: bridgeAVLtoAppSchema,
  claimAVLAccount: claimAVLAccountSchema,
  requestStakeAVL: requestStakeAVLSchema,
};
