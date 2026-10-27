import { BrowserProvider, parseUnits, toBeHex, type Eip1193Provider, type JsonRpcSigner } from "ethers";
import { CHAIN_ID, RPC_URL, STATUS, busTicket, chainNow, errorMessage, eurc, formatEur } from "./contracts";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { on?: (event: string, cb: () => void) => void };
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let signer: JsonRpcSigner | undefined;

function setMessage(text: string, isError = false) {
  const el = $("rider-msg");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

/** Runs a wallet action with button disabling and status messages. */
async function run(label: string, action: () => Promise<void>) {
  const buttons = document.querySelectorAll<HTMLButtonElement>("#rider button");
  buttons.forEach((b) => (b.disabled = true));
  setMessage(`${label}… confirm in MetaMask`);
  try {
    await action();
    await refresh();
    setMessage(`${label}: done ✔`);
  } catch (error) {
    setMessage(`${label} failed: ${errorMessage(error)}`, true);
    await refresh();
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

/** Makes sure MetaMask is on the local hardhat chain, adding it if needed. */
async function switchToLocalChain(ethereum: Eip1193Provider) {
  const chainId = toBeHex(CHAIN_ID);
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch {
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId, chainName: "Hardhat Local", rpcUrls: [RPC_URL], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
    });
  }
}

async function connect() {
  if (!window.ethereum) {
    setMessage("MetaMask not found. Install it and reload the page.", true);
    return;
  }
  await switchToLocalChain(window.ethereum);
  signer = await new BrowserProvider(window.ethereum).getSigner();
  $("account").textContent = signer.address;
  $("connect").textContent = "Connected";
  await refresh();
}

async function faucet() {
  await run("Getting test EUR", async () => {
    await (await eurc(signer).mint(signer!.address, parseUnits("10", 6))).wait();
  });
}

/** approve (only if the allowance is too low) + buy: up to two MetaMask popups. */
async function buy() {
  await run("Buying ticket", async () => {
    const price: bigint = await busTicket().price();
    const spender = await busTicket().getAddress();
    if ((await eurc().allowance(signer!.address, spender)) < price) {
      setMessage("Step 1/2: approve EUR spending in MetaMask");
      await (await eurc(signer).approve(spender, price)).wait();
      setMessage("Step 2/2: confirm the purchase in MetaMask");
    }
    await (await busTicket(signer).buy()).wait();
  });
}

async function validate(tokenId: bigint) {
  await run(`Validating ticket #${tokenId}`, async () => {
    await (await busTicket(signer).validate(tokenId)).wait();
  });
}

/** Finds the tickets the user currently owns by replaying Transfer events. */
async function ownedTicketIds(owner: string): Promise<bigint[]> {
  const contract = busTicket();
  const received = await contract.queryFilter(contract.filters.Transfer(null, owner), 0);
  const ids = [...new Set(received.map((e) => ("args" in e ? (e.args.tokenId as bigint) : 0n)))];
  // A ticket received earlier may have been given away since
  const owned = await Promise.all(ids.map(async (id) => ((await contract.ownerOf(id)) === owner ? id : null)));
  return owned.filter((id): id is bigint => id !== null).sort((a, b) => Number(b - a));
}

async function renderTickets() {
  const list = $("tickets");
  const contract = busTicket();
  const [ids, duration, now] = await Promise.all([ownedTicketIds(signer!.address), contract.DURATION(), chainNow()]);

  if (ids.length === 0) {
    list.innerHTML = `<li class="empty">No tickets yet. Buy one above.</li>`;
    return;
  }

  list.replaceChildren(
    ...(await Promise.all(
      ids.map(async (id) => {
        const status = STATUS[Number(await contract.status(id))];
        const validatedAt: bigint = await contract.validatedAt(id);
        const li = document.createElement("li");
        li.className = `ticket ${status.toLowerCase()}`;

        let detail = "Validate when you board the bus";
        if (status === "Active") {
          const minutesLeft = (validatedAt + duration - now + 59n) / 60n;
          detail = `Valid for ${minutesLeft} more min`;
        } else if (status === "Expired") {
          detail = `Used ${new Date(Number(validatedAt) * 1000).toLocaleString()}`;
        }

        li.innerHTML = `
          <div><strong>Ticket #${id}</strong><br /><small>${detail}</small></div>
          <span class="badge">${status}</span>`;
        if (status === "Unused") {
          const button = document.createElement("button");
          button.className = "primary";
          button.textContent = "Validate";
          button.onclick = () => validate(id);
          li.append(button);
        }
        return li;
      }),
    )),
  );
}

export async function refresh() {
  $("price").textContent = formatEur(await busTicket().price());
  if (!signer) return;
  $("balance").textContent = formatEur(await eurc().balanceOf(signer.address));
  (["faucet", "buy"] as const).forEach((id) => ($<HTMLButtonElement>(id).disabled = false));
  await renderTickets();
}

export function initRider() {
  $("connect").onclick = () => connect().catch((e) => setMessage(errorMessage(e), true));
  $("faucet").onclick = faucet;
  $("buy").onclick = buy;
  // Re-connect with the new account when the user switches it in MetaMask
  window.ethereum?.on?.("accountsChanged", () => signer && connect());
}
