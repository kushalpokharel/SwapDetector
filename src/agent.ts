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
import {ethers} from "ethers";
import { soliditySha256 } from "ethers/lib/utils";
const factoryabi = require('/home/kushal/Work/uniswap_swap_detector/src/factoryabi.json');

let findingsCount = 0;
const provider = new Web3.providers.HttpProvider(
  'https://rinkeby.infura.io/v3/11b5da3171f94a138ac566452555eba7'
);
let web3 = new Web3(provider);

const pairAddresses: string[] = [];

function getPair(tokenA:string, tokenB:string) {
    
  let _hexadem = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';
  let _factory = "0x1F98431c8aD98523631AE4a59f267346ea31F984".toLowerCase();
  let [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

  let abiEncoded1 =  web3.eth.abi.encodeParameters(['address', 'address'], [token0, token1]);
  abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
  let salt = web3.utils.soliditySha3(abiEncoded1);
  let abiEncoded2 =  web3.eth.abi.encodeParameters(['address', 'bytes32'], [_factory, salt]);
  let pair = "";
  abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substr(2);
  let a = Web3.utils.soliditySha3( '0xff' + abiEncoded2, _hexadem )
  if(a !== null)
    pair = '0x' + a.substr(26);
  return pair
}



function getCreate2Address(
  factoryAddress:string,
  [tokenA, tokenB]:string[],
  bytecode:string
) {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'address'], [token0, token1])),
    ethers.utils.keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return ethers.utils.getAddress(`0x${ethers.utils.keccak256(sanitizedInputs).slice(-40)}`)
}

function getaddress(
  factoryAddress:string,
  [tokenA, tokenB]:string[],
  bytecode:string
){
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
  let hash1 = web3.utils.soliditySha3(token0,token1);
  let hash2 = web3.utils.soliditySha3(bytecode);
  if(hash1!==null && hash2!==null)
    return web3.utils.soliditySha3(
      '0xff',
      factoryAddress,
      hash1,
      hash2
    )
}

async function getAddr(token0:string,token1:string) {
  const uniContract = new web3.eth.Contract(
    factoryabi,
    '0x1F98431c8aD98523631AE4a59f267346ea31F984'
  );
  let a =  await(await uniContract.methods.getPool(token0,token1,10000)).call();
  // uniContract.methods.getPool(token0,token1,10000).call().then(function(result:any){
  //   console.log(result);
  //   return result;
  // })
  console.log("addr " +a);
  return a;
}

const initialize: Initialize = async() =>{

  const token0 = '0x6b175474e89094c44da98b954eedeac495271d0f'; //dai token
  const token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'.toLowerCase(); //weth token
  const factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const _hexadem = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';
  const contractAddress = getCreate2Address(
    factory,
    [token0,token1],
    _hexadem
  )
  const newAddress = getaddress(
    factory,
    [token0,token1],
    _hexadem
  )

  const addr = getPair(
    token0,
    token1
  );

  const ad = await getAddr(token0,token1);

  console.log(contractAddress);
  console.log(newAddress);
  console.log(addr);
  console.log("address "+ad);
}

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;

  // filter the transaction logs for Tether transfer events
  // const tetherTransferEvents = txEvent.filterLog(
  //   ERC20_TRANSFER_EVENT,
  //   TETHER_ADDRESS
  // );

  // tetherTransferEvents.forEach((transferEvent) => {
  //   // extract transfer event arguments
  //   const { to, from, value } = transferEvent.args;
  //   // shift decimals of transfer value
  //   const normalizedValue = value.div(10 ** TETHER_DECIMALS);

  //   // if more than 10,000 Tether were transferred, report it
  //   if (normalizedValue.gt(10000)) {
  //     findings.push(
  //       Finding.fromObject({
  //         name: "High Tether Transfer",
  //         description: `High amount of USDT transferred: ${normalizedValue}`,
  //         alertId: "FORTA-1",
  //         severity: FindingSeverity.Low,
  //         type: FindingType.Info,
  //         metadata: {
  //           to,
  //           from,
  //         },
  //       })
  //     );
  //     findingsCount++;
  //   }
  // });

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
