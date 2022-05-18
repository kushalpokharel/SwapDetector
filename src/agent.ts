import {
  BlockEvent,
  Finding,
  HandleBlock,
  HandleTransaction,
  TransactionEvent,
  FindingSeverity,
  FindingType,
  Initialize,
  getJsonRpcUrl
} from "forta-agent";

import {BigNumberish, ethers} from "ethers";
import { getCreate2Address } from "ethers/lib/utils";
import { defaultAbiCoder } from "ethers/lib/utils";
import { keccak256 } from "ethers/lib/utils";
const factoryabi = require('/home/kushal/Work/uniswap_swap_detector/src/factoryabi.json');

let findingsCount = 0;
const provider = new ethers.providers.JsonRpcProvider(getJsonRpcUrl());
const poolAbi  =  [
  "function token0() public view returns (address)",
  "function token1() public view returns (address)",
  "function fee() public view returns (uint24)"
]
const getReference = (addr:string) =>{
  const contractRef = new ethers.Contract(
    addr,
    poolAbi,
    provider
  );
  return contractRef;
}

const uniContract = new ethers.Contract(
  '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  factoryabi,
  provider
);

//working correctly: querying the factory contract and returning the pool address
async function getAddr(token0:string,token1:string, fee:BigNumberish) {
  
  let a =  await uniContract.getPool(token0,token1,fee);
  console.log("addr " +a);
  return a;
}

//not working correctly: calculating the address using create2.
const v3Create2 = (token0:string, token1:string, fee:BigNumberish) => {
  const salt: string = keccak256(defaultAbiCoder.encode(["address", "address", "uint24"], [token0, token1, fee]));
  const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const V3_PAIR_INIT_CODE = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
  return getCreate2Address(V3_FACTORY, salt, V3_PAIR_INIT_CODE).toLowerCase();
}

// const initialize: Initialize = async() =>{

//   const token0 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(); //dai token
//   const token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'.toLowerCase(); //weth token

//   // const ad = await getAddr(token0,token1);
//   const create2addr = v3Create2(token0, token1, 3000);

//   console.log(create2addr);
//   // console.log("address "+ad);
//   // pairAddresses.push(ad);
// }

export const EVENT_NAME = "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)";

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];
  // console.log(txEvent);
  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;
  // filter the transaction logs for Swap events
  const swapEvents = txEvent.filterLog(
    EVENT_NAME
  );
  await Promise.all(
    swapEvents.map(async (swapEvent)  => {
      // console.log(swapEvent);
      // extract the pool address from the swap event
      const contractAddress = swapEvent.address;
      //get the smart contract reference from the above address
      const contractRef = getReference(contractAddress);
      //get these parameters from the pool contract above
      const token0Addr = await contractRef.token0();
      const token1Addr = await contractRef.token1();
      const fee = await contractRef.fee();
      //get/calculate the pool contract from above parameters
      const calcAddr = v3Create2(token0Addr,token1Addr,fee);
      const calcAddr1 = await getAddr(token0Addr,token1Addr,fee);
      //check if the pool address is same 
      if(calcAddr1.toLowerCase()===contractAddress.toLowerCase()){
        findings.push(
          Finding.fromObject({
            name: "SWAP",
            description: `Swap method called in the pool ${calcAddr1}`,
            alertId: "FORTA-1",
            severity: FindingSeverity.Low,
            type: FindingType.Info,
            metadata: {
              contractAddress,
              token0Addr,
              token1Addr,
              fee
            },
          })
        );
      }
      // console.log("calcAddr " +calcAddr);
      // console.log("calcAddr1 " +calcAddr1);
      // console.log("token1 "+token1Addr);
      // console.log(contractAddress);
      
      findingsCount++;
    })
  );

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
