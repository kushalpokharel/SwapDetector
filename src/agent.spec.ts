import {
  FindingType,
  FindingSeverity,
  Finding,
  HandleTransaction,
  ethers,
} from "forta-agent";
import agent, { EVENT_NAME, provideHandleTransaction } from "./agent";
import {
    createAddress,
    TestTransactionEvent,
  } from 'forta-agent-tools/lib/tests';
import { BigNumberish } from "ethers";
import { getCreate2Address, defaultAbiCoder, keccak256, Interface } from "ethers/lib/utils";
// import { encodeParameter, encodeParameters } from "forta-agent-tools";
import {when} from 'jest-when';

const v3Create2 = (token0:string, token1:string, fee:BigNumberish) => {
    const salt: string = keccak256(defaultAbiCoder.encode(["address", "address", "uint24"], [token0, token1, fee]));
    const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    const V3_PAIR_INIT_CODE = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
    return getCreate2Address(V3_FACTORY, salt, V3_PAIR_INIT_CODE).toLowerCase();
  }

const createFinding = (contractAddress:string,token0Addr:string,token1Addr:string,fee:any) =>{
    return Finding.fromObject({
        name: "SWAP",
        description: `Swap method called in the pool ${contractAddress.toLowerCase()}`,
        alertId: "FORTA-1",
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
            contractAddress,
            token0Addr,
            token1Addr,
            fee
        },
    });
}
const ethmnwAddress = "0x78194ba1a135a71f7fba71fda7cdd3885872b8ff";
const ethusdcAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
const ethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const mnwAddress = "0xd3E4Ba569045546D09CF021ECC5dFe42b1d7f6E4";
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const eventName = "Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)";
const event_iface = new Interface(["event Swap(address indexed,address indexed,int256,int256,uint160,uint128,int24)"]);
const event = event_iface.getEvent("Swap");

describe("Swap method detector on Uniswap's pool ", () => {
  let handleTransaction: HandleTransaction;
  const mockFetcher = jest.fn();
//   const mockTxEvent = createTransactionEvent({} as any);

  beforeAll(() => {
    handleTransaction = provideHandleTransaction(mockFetcher);
    mockFetcher.mockClear();
  });

  describe("handleTransaction", () => {
    it("returns empty findings if there is no swap call", async () => {
      
        const txEvent: TestTransactionEvent = new TestTransactionEvent().setFrom("0xaa").setTo("0xbb");
        const findings = await handleTransaction(txEvent);
        expect(findings).toEqual([]);
    });

    it("returns empty finding even if there is a Swap event but the address doesn't match the pool address", async () => {

        when(mockFetcher).calledWith(createAddress("0xaa")).mockReturnValue(["","",""]);
        const txEvent:TestTransactionEvent = new TestTransactionEvent().setFrom("0xaaa").setTo("0xaaa");
        const log = event_iface.encodeEventLog(event, ["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"]);
        txEvent.addAnonymousEventLog(createAddress("0xaa"),log.data, ...log.topics);
        const findings = await handleTransaction(txEvent);
        expect(findings).toEqual([]);
    });

    it("returns a finding if there is a Swap event emitted by the pool contract", async () => {

        when(mockFetcher).calledWith(createAddress(ethmnwAddress)).mockReturnValue([ethAddress,mnwAddress,3000]);
        const txEvent:TestTransactionEvent = new TestTransactionEvent().setFrom("0xaaa");
        const log = event_iface.encodeEventLog(event, ["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"])
        txEvent.addAnonymousEventLog(createAddress(ethmnwAddress),log.data, ...log.topics);
        // txEvent.addEventLog("Swap(address,address,int256,int256,uint160,uint128,int24)",ethmnwAddress, encodeParameters(["indexed address","indexed address","int256","int256","uint160","uint128","int24"],["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"]));
        const findings = await handleTransaction(txEvent);
        expect(findings).toEqual([createFinding(v3Create2(ethAddress,mnwAddress,3000),ethAddress,mnwAddress,3000)]);
    },10000);

    it("returns multiple findings if there is more than one Swap event emitted by the pool contract in a transaction", async () => {
      when(mockFetcher).calledWith(createAddress(ethmnwAddress)).mockReturnValue([ethAddress,mnwAddress,3000]);
      when(mockFetcher).calledWith(createAddress(ethusdcAddress).toLowerCase()).mockReturnValue([ethAddress,usdcAddress,3000]);
      const txEvent:TestTransactionEvent = new TestTransactionEvent().setFrom("0xaaa");
      const log = event_iface.encodeEventLog(event, ["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"])
      const log1 = event_iface.encodeEventLog(event, [createAddress("0x123"),createAddress("0x321"),"0x11","0xaa","0x12","0xabc","123"]);
      txEvent.addAnonymousEventLog(ethmnwAddress,log.data, ...log.topics);
      txEvent.addAnonymousEventLog(ethusdcAddress,log1.data,...log1.topics)
      // txEvent.addEventLog("Swap(address,address,int256,int256,uint160,uint128,int24)",ethmnwAddress, encodeParameters(["indexed address","indexed address","int256","int256","uint160","uint128","int24"],["0xE592427A0AEce92De3Edee1F18E0157C05861564","0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57","-0x042a49c079","0x7c260bbc0f374160", "0x5738dbc076b09c3c96106c3a5fee","0xe11969b37e863182","234"]));
      const findings = await handleTransaction(txEvent);
      expect(findings).toEqual([
        
        createFinding(v3Create2(ethAddress,mnwAddress,3000),ethAddress,mnwAddress,3000),
        createFinding(v3Create2(usdcAddress,ethAddress,3000),ethAddress,usdcAddress,3000),
      ]);
    },10000);

  });
});
