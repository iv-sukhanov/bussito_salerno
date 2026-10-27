import { Contract, JsonRpcProvider, formatUnits, type ContractRunner } from "ethers";

export const RPC_URL = "http://127.0.0.1:8545";
export const CHAIN_ID = 31337n; // hardhat node

// Human-readable ABIs: only the functions/events the UI uses.
const BUS_TICKET_ABI = [
  "function price() view returns (uint256)",
  "function DURATION() view returns (uint256)",
  "function buy() returns (uint256)",
  "function validate(uint256 tokenId)",
  "function status(uint256 tokenId) view returns (uint8)",
  "function isValid(uint256 tokenId) view returns (bool)",
  "function validatedAt(uint256 tokenId) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "error NotTicketOwner()",
  "error AlreadyValidated()",
  "error TransferAfterValidation()",
  "error ERC721NonexistentToken(uint256 tokenId)",
];

const EURC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
];

// Addresses written by `npx hardhat ignition deploy ... --network localhost`.
// import.meta.glob returns {} instead of failing the build when the file
// doesn't exist yet, so we can show a helpful message.
const deployments = import.meta.glob<Record<string, string>>(
  "../../ignition/deployments/chain-31337/deployed_addresses.json",
  { eager: true, import: "default" },
);
const addresses = Object.values(deployments)[0];

export const BUS_TICKET_ADDRESS = addresses?.["BusTicketModule#BusTicket"];
export const EURC_ADDRESS = addresses?.["BusTicketModule#MockEURC"];

export const STATUS = ["Unused", "Active", "Expired"] as const;
export type TicketStatus = (typeof STATUS)[number];

// Read-only connection straight to the node, used by the conductor and for
// listing tickets. Writes go through MetaMask instead.
// cacheTimeout -1: ethers otherwise reuses identical request results for
// 250ms, and a local node mines faster than that, so lists would lag behind.
export const readProvider = new JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });

export const busTicket = (runner: ContractRunner = readProvider) =>
  new Contract(BUS_TICKET_ADDRESS!, BUS_TICKET_ABI, runner);
export const eurc = (runner: ContractRunner = readProvider) => new Contract(EURC_ADDRESS!, EURC_ABI, runner);

export const formatEur = (units: bigint) => `€${Number(formatUnits(units, 6)).toFixed(2)}`;

export async function chainNow(): Promise<bigint> {
  const block = await readProvider.getBlock("latest");
  return BigInt(block!.timestamp);
}

/** Turns a contract revert into a readable message. */
export function errorMessage(error: unknown): string {
  const e = error as { revert?: { name?: string }; shortMessage?: string; message?: string; code?: unknown };
  if (e.code === "ACTION_REJECTED") return "Transaction rejected in wallet";
  if (e.revert?.name) return e.revert.name;
  return e.shortMessage ?? e.message ?? String(error);
}
