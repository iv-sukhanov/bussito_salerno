import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BusTicketModule", (m) => {
  // Ticket price in wei, overridable via --parameters
  const price = m.getParameter("price", 1_000_000_000_000_000n); // 0.001 ETH

  const busTicket = m.contract("BusTicket", [price]);

  return { busTicket };
});
