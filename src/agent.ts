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
  'https://mainnet.infura.io/v3/a0f979b01d5f4fbaae2b84575d7fb601'
);
let web3 = new Web3(provider);

// const pairAddresses: string[] = [];

async function getAddr(token0:string,token1:string) {
  const uniContract = new web3.eth.Contract(
    factoryabi,
    '0x1F98431c8aD98523631AE4a59f267346ea31F984'
  );
  let a =  await uniContract.methods.getPool(token0,token1,3000).call();
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

  // const ad = await getAddr(token0,token1);
  const create2addr = v3Create2(token0, token1, 3000);

  console.log(create2addr);
  // console.log("address "+ad);
  // pairAddresses.push(ad);
}

export const EVENT_NAME = "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)";

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];
  // console.log(txEvent);
  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;
  // filter the transaction logs for Tether transfer events
  const swapEvents = txEvent.filterLog(
    EVENT_NAME
  );

  swapEvents.forEach((swapEvent) => {
    console.log("here");
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
  handleTransaction,
  // handleBlock
};
