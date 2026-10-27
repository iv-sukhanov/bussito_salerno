import "./style.css";
import { BUS_TICKET_ADDRESS, chainNow, readProvider } from "./contracts";
import { initConductor } from "./conductor";
import { initRider, refresh } from "./rider";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function showSetupError(text: string) {
  const banner = $("setup-error");
  banner.textContent = text;
  banner.hidden = false;
}

// Tab switching between the rider and conductor views
document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll<HTMLElement>(".view").forEach((v) => (v.hidden = v.id !== tab.dataset.view));
  };
});

// Chain time can differ from the wall clock (blocks only get mined on
// transactions, and we can time travel), so ticket validity uses this.
async function showChainTime() {
  $("chain-time").textContent = `Chain time: ${new Date(Number(await chainNow()) * 1000).toLocaleString()}`;
}

// Demo helper: hardhat node's dev RPC methods move the clock and mine a block
$("skip-time").onclick = async () => {
  await readProvider.send("evm_increaseTime", [91 * 60]);
  await readProvider.send("evm_mine", []);
  await showChainTime();
  await refresh();
};

async function start() {
  if (!BUS_TICKET_ADDRESS) {
    showSetupError(
      "No deployment found. Run `npx hardhat node` and `npx hardhat ignition deploy ignition/modules/BusTicket.ts --network localhost`, then reload.",
    );
    return;
  }
  try {
    if ((await readProvider.getCode(BUS_TICKET_ADDRESS)) === "0x") {
      showSetupError(
        "Contracts not found on the node. It was probably restarted: delete ignition/deployments/chain-31337 and deploy again.",
      );
      return;
    }
  } catch {
    showSetupError("Can't reach the hardhat node at 127.0.0.1:8545. Is `npx hardhat node` running?");
    return;
  }

  initRider();
  initConductor();
  await Promise.all([refresh(), showChainTime()]);
  setInterval(showChainTime, 5000);
}

start();
