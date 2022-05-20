import {
  FindingType,
  FindingSeverity,
  Finding,
  HandleTransaction,
  createTransactionEvent,
  ethers,
} from "forta-agent";
import agent, { EVENT_NAME } from "./agent";
import {
    createAddress,
    TestTransactionEvent,
  } from 'forta-agent-tools/lib/tests';
import { BigNumberish } from "ethers";
import { getCreate2Address, defaultAbiCoder, keccak256 } from "ethers/lib/utils";
import { encodeParameter, encodeParameters } from "forta-agent-tools";

const v3Create2 = (token0:string, token1:string, fee:BigNumberish) => {
    const salt: string = keccak256(defaultAbiCoder.encode(["address", "address", "uint24"], [token0, token1, fee]));
    const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    const V3_PAIR_INIT_CODE = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
    return getCreate2Address(V3_FACTORY, salt, V3_PAIR_INIT_CODE).toLowerCase();
  }

const createFinding = (poolAddr:string,token0Addr:string,token1Addr:string,fee:string) =>{
    return Finding.fromObject({
        name: "SWAP",
        description: `Swap method called in the pool ${poolAddr}`,
        alertId: "FORTA-1",
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
            poolAddr,
            token0Addr,
            token1Addr,
            fee
        },
    });
}
const ethmnwAddress = "0x78194ba1a135a71f7fba71fda7cdd3885872b8ff";
const ethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const mnwAddress = "0xd3E4Ba569045546D09CF021ECC5dFe42b1d7f6E4";
const eventName = "Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)";

describe("Swap method detectpr on Uniswap's pool ", () => {
  let handleTransaction: HandleTransaction;
//   const mockTxEvent = createTransactionEvent({} as any);

  beforeAll(() => {
    handleTransaction = agent.handleTransaction;
  });

  describe("handleTransaction", () => {
    it("returns empty findings if there is no swap call", async () => {
      
        const txEvent: TestTransactionEvent = new TestTransactionEvent().setFrom("0xaa").setTo("0xbb");
        const findings = await handleTransaction(txEvent);
        expect(findings).toEqual([]);
    });

    it("returns empty finding even if there is a Swap event but the address doesn't match the pool event", async () => {
    
        const txEvent:TestTransactionEvent = new TestTransactionEvent().setFrom("0xaaa").setTo("0xaaa");
    });
    it("returns a finding even if there is a Swap event emitted by the pool contract", async () => {
    
        const txEvent:TestTransactionEvent = new TestTransactionEvent().setFrom("0xaaa");
        txEvent.addEventLog("Swap(address,address,int256,int256,uint160,uint128,int24)",ethmnwAddress, encodeParameters(["address","address","int256","int256","uint160","uint128","int24"],["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"]));
        console.log(txEvent);
        const findings = await handleTransaction(txEvent);
        console.log(findings);
        expect(findings).toEqual([createFinding(v3Create2(ethAddress,mnwAddress,3000),ethAddress,mnwAddress,"3000")]);
    });
  });
});
