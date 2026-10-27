import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deploys MockEURC and a BusTicket contract that accepts it as payment.
// The deploying account becomes the BusTicket owner.
export default buildModule("BusTicketModule", (m) => {
  // Price in the token's smallest unit (6 decimals): 1_300_000 = 1.30 EUR
  const price = m.getParameter("price", 1_300_000n);

  const eurc = m.contract("MockEURC");
  const busTicket = m.contract("BusTicket", [eurc, price]);

  return { eurc, busTicket };
});
