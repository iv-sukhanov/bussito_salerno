// End-to-end demo of the ticket lifecycle: buy -> validate -> check -> expire.
//
//   npx hardhat run scripts/demo.ts                      # in-memory network
//   npx hardhat node                                     # terminal 1
//   npx hardhat run scripts/demo.ts --network localhost  # terminal 2
//
// Uses the Ignition module, so on localhost it reuses the contracts from
// `npx hardhat ignition deploy ... --network localhost` if they exist.
// Time travel only works on local networks, not on Sepolia.
import { network } from "hardhat";
import BusTicketModule from "../ignition/modules/BusTicket.js";

const { ethers, ignition, networkHelpers } = await network.create();

const STATUS = ["Unused", "Active", "Expired"];
const eur = (units: bigint) => `${ethers.formatUnits(units, 6)} EUR`;
const step = (title: string) => console.log(`\n=== ${title} ===`);

// Default accounts: #0 deploys (admin), #1 rides the bus, #2 checks tickets
const [admin, rider, conductor] = await ethers.getSigners();

step("Deploy");
const deployed = await ignition.deploy(BusTicketModule);
// Re-attach to get TypeChain-typed contract instances
const eurc = await ethers.getContractAt("MockEURC", await deployed.eurc.getAddress());
const busTicket = await ethers.getContractAt("BusTicket", await deployed.busTicket.getAddress());
const price = await busTicket.price();
console.log(`MockEURC:  ${await eurc.getAddress()}`);
console.log(`BusTicket: ${await busTicket.getAddress()}`);
console.log(`Admin:     ${admin.address}`);
console.log(`Rider:     ${rider.address}`);
console.log(`Conductor: ${conductor.address}`);
console.log(`Ticket price: ${eur(price)}`);

step("Rider gets euros from the faucet");
await (await eurc.connect(rider).mint(rider.address, ethers.parseUnits("10", 6))).wait();
console.log(`Rider balance: ${eur(await eurc.balanceOf(rider.address))}`);

step("Rider approves and buys a ticket");
await (await eurc.connect(rider).approve(await busTicket.getAddress(), price)).wait();
const buyReceipt = await (await busTicket.connect(rider).buy()).wait();
// buy() returns the id, but a transaction can't hand back return values,
// so read it from the TicketBought event instead. Skip the EURC logs: its
// ERC-20 Transfer has the same signature as ERC-721 Transfer and won't parse.
const bought = buyReceipt!.logs
  .filter((log) => log.address === busTicket.target)
  .map((log) => busTicket.interface.parseLog(log))
  .find((parsed) => parsed?.name === "TicketBought");
const ticketId: bigint = bought!.args.tokenId;
console.log(`Bought ticket #${ticketId}, owner: ${await busTicket.ownerOf(ticketId)}`);
console.log(`Rider balance: ${eur(await eurc.balanceOf(rider.address))}`);

async function conductorCheck() {
  const asConductor = busTicket.connect(conductor);
  const status = STATUS[Number(await asConductor.status(ticketId))];
  const valid = await asConductor.isValid(ticketId);
  const ownerOk = (await asConductor.ownerOf(ticketId)) === rider.address;
  console.log(`Conductor check #${ticketId}: status=${status}, valid=${valid}, owned by rider=${ownerOk}`);
}

step("Conductor checks before boarding");
await conductorCheck();

step("Rider boards and validates the ticket");
await (await busTicket.connect(rider).validate(ticketId)).wait();
const validUntil = (await busTicket.validatedAt(ticketId)) + (await busTicket.DURATION());
console.log(`Validated, valid until ${new Date(Number(validUntil) * 1000).toISOString()}`);

step("Conductor checks on the bus");
await conductorCheck();

step("Rider tries to validate the same ticket again");
try {
  // staticCall simulates the transaction without sending it
  await busTicket.connect(rider).validate.staticCall(ticketId);
  console.log("Unexpected: second validation succeeded");
} catch (error) {
  const decoded = busTicket.interface.parseError((error as { data?: string }).data ?? "0x");
  console.log(`Rejected: ${decoded?.name ?? error}`);
}

step("91 minutes later");
await networkHelpers.time.increase(91 * 60);
await conductorCheck();

step("Admin withdraws revenue");
await (await busTicket.connect(admin).withdraw()).wait();
console.log(`Admin balance: ${eur(await eurc.balanceOf(admin.address))}`);
console.log(`Contract balance: ${eur(await eurc.balanceOf(await busTicket.getAddress()))}`);
