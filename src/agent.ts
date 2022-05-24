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
import {
  createAddress,
} from 'forta-agent-tools/lib/tests';
import {BigNumberish, ethers, providers} from "ethers";
import { getCreate2Address, id, Interface } from "ethers/lib/utils";
import { defaultAbiCoder } from "ethers/lib/utils";
import { keccak256 } from "ethers/lib/utils";

let findingsCount = 0;
let provider:providers.Provider= new ethers.providers.JsonRpcProvider(getJsonRpcUrl());;
const poolAbi  =  [
  "function token0() public view returns (address)",
  "function token1() public view returns (address)",
  "function fee() public view returns (uint24)"
]
const fetcher = async(addr:string) =>{
  const contractRef = new ethers.Contract(
    addr,
    poolAbi,
    provider
  );
  let token0Addr="";
  let token1Addr="";
  let fee="";
  
  try{
    token0Addr =   contractRef.token0();
    token1Addr =   contractRef.token1();
    fee =  contractRef.fee();
    // console.log(await Promise.all([token0Addr,token1Addr,fee]));
    
    return await Promise.all([token0Addr, token1Addr, fee]);
  }
  catch(e){
    console.log("error");
    return [token0Addr,token1Addr,fee];
  }
  
}

//querying the factory contract and returning the pool address
async function getAddr(token0:string,token1:string, fee:BigNumberish) {
  const getPool = 'function getPool(address, address, uint24) public view returns (address)'
  const f_interface= new Interface([getPool]);
  console.log(f_interface);
  console.log(provider);
  const uniContract = new ethers.Contract(
    '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    f_interface,
    provider
  );
  let a =  await uniContract.getPool(token0,token1,fee);
  // console.log("addr " +a);
  return a;
}

//calculating the address using create2.
const v3Create2 = (token0:string, token1:string, fee:BigNumberish) => {

  if(token0.toLowerCase()>token1.toLowerCase())
    [token0,token1] = [token1,token0];
  
  const salt: string = keccak256(defaultAbiCoder.encode(["address", "address", "uint24"], [token0, token1, fee]));
  const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const V3_PAIR_INIT_CODE = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
  return getCreate2Address(V3_FACTORY, salt, V3_PAIR_INIT_CODE).toLowerCase();
}

const initialize: Initialize = async() =>{

  provider = new ethers.providers.JsonRpcProvider(getJsonRpcUrl());
}

export const EVENT_NAME = "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)";

export const provideHandleTransaction =
(
  fetcher:any
): HandleTransaction => async (
    txEvent: TransactionEvent
  ) => {
  const findings: Finding[] = [];

  // console.log(txEvent.logs);
  // filter the transaction logs for Swap events
  const swapEvents = txEvent.filterLog(
    EVENT_NAME
  );

  await Promise.all(
    swapEvents.map(async (swapEvent)  => {
      // console.log(swapEvent);
      // extract the pool address from the swap event
      const contractAddress = swapEvent.address;
      //get these parameters from the pool contract above
      const [token0Addr,token1Addr,fee] = await fetcher(contractAddress.toLowerCase());
      if(token0Addr==="")
        return [];
      
      //get/calculate the pool contract from above parameters
      const calcAddr1 = v3Create2(token0Addr,token1Addr,fee);
      // const calcAddr = await getAddr(token0Addr,token1Addr,fee);
      // console.log(calcAddr);
      //check if the pool address is same 
      if(calcAddr1.toLowerCase()===contractAddress.toLowerCase()){
        
        findings.push(
          Finding.fromObject({
            name: "SWAP",
            description: `Swap method called in the pool ${calcAddr1.toLowerCase()}`,
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
      
    })
  );

  return findings;
};

export default {
  initialize:initialize,
  handleTransaction:provideHandleTransaction(fetcher),
  // handleBlock
};
