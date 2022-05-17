import {
  BlockEvent,
  Finding,
  HandleBlock,
  HandleTransaction,
  TransactionEvent,
  FindingSeverity,
  FindingType,
  Initialize
} from "forta-agent";

import  Web3 from "web3";
import {BigNumberish, ethers} from "ethers";
import { getCreate2Address } from "ethers/lib/utils";
import { defaultAbiCoder } from "ethers/lib/utils";
import { keccak256 } from "ethers/lib/utils";
const factoryabi = require('/home/kushal/Work/uniswap_swap_detector/src/factoryabi.json');

let findingsCount = 0;
const provider = new Web3.providers.HttpProvider(
  'https://rinkeby.infura.io/v3/11b5da3171f94a138ac566452555eba7'
);
let web3 = new Web3(provider);

const pairAddresses: string[] = [];

async function getAddr(token0:string,token1:string) {
  const uniContract = new web3.eth.Contract(
    factoryabi,
    '0x1F98431c8aD98523631AE4a59f267346ea31F984'.toLowerCase()
  );
  let a =  await uniContract.methods.getPool(token0,token1,50000).call();
  console.log("addr " +a);
  return a;
}

const v3Create2 = (token0:string, token1:string, fee:BigNumberish) => {
  const salt: string = keccak256(defaultAbiCoder.encode(["address", "address", "uint24"], [token0, token1, fee]));
  const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'.toLowerCase();
  const V3_PAIR_INIT_CODE = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';
  return getCreate2Address(V3_FACTORY, salt, V3_PAIR_INIT_CODE).toLowerCase();
}

const initialize: Initialize = async() =>{

  const token0 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(); //dai token
  const token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'.toLowerCase(); //weth token
  const factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const _hexadem = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';

  const condition = web3.utils.soliditySha3(token0,token1,3000);
  let caddress = "";
  if(condition)
    caddress = getCreate2Address(factory,condition,_hexadem)

  const ad = await getAddr(token0,token1);
  const create2addr = v3Create2(token0, token1, 3000);

  console.log(create2addr);
  console.log("address "+ad);
  pairAddresses.push(ad);
}

export const FUNCTION_NAME = "function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes data)";

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;
  
  // filter the transaction logs for Tether transfer events
  const swapEvents = txEvent.filterFunction(
    [FUNCTION_NAME],
    pairAddresses[0]
  );

  swapEvents.forEach((swapEvent) => {
    // extract transfer event arguments
    const { to, from, value } = swapEvent.args;
    // shift decimals of transfer value
    

    findings.push(
      Finding.fromObject({
        name: "SWAP",
        description: `Swap method called`,
        alertId: "FORTA-1",
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
          to,
          from,
        },
      })
    );
    findingsCount++;
  });

  return findings;
};

// const handleBlock: HandleBlock = async (blockEvent: BlockEvent) => {
//   const findings: Finding[] = [];
//   // detect some block condition
//   return findings;
// }

export default {
  initialize,
  handleTransaction,
  // handleBlock
};
