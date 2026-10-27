import { getAddress, isAddress } from "ethers";
import { STATUS, busTicket, chainNow } from "./contracts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type Verdict = { ok: boolean; title: string; reason: string };

/**
 * Same check a real conductor would do: the ticket must be Active AND owned by
 * the person presenting it. Only view calls, so no wallet or gas is needed.
 */
async function checkTicket(tokenId: bigint, rider: string): Promise<Verdict> {
  const contract = busTicket();

  let owner: string;
  try {
    owner = await contract.ownerOf(tokenId);
  } catch {
    return { ok: false, title: "NOT VALID", reason: `Ticket #${tokenId} does not exist` };
  }

  if (owner !== getAddress(rider)) {
    return { ok: false, title: "NOT VALID", reason: `Ticket #${tokenId} belongs to someone else (${owner})` };
  }

  const status = STATUS[Number(await contract.status(tokenId))];
  if (status === "Unused") {
    return { ok: false, title: "NOT VALIDATED", reason: "The ticket was never validated on boarding" };
  }

  const validUntil: bigint = (await contract.validatedAt(tokenId)) + (await contract.DURATION());
  const until = new Date(Number(validUntil) * 1000).toLocaleTimeString();
  if (status === "Expired") {
    return { ok: false, title: "EXPIRED", reason: `Expired at ${until}` };
  }

  const minutesLeft = (validUntil - (await chainNow()) + 59n) / 60n;
  return { ok: true, title: "VALID", reason: `Valid until ${until} (${minutesLeft} min left)` };
}

export function initConductor() {
  $<HTMLFormElement>("check-form").onsubmit = async (event) => {
    event.preventDefault();
    const result = $("check-result");
    const id = $<HTMLInputElement>("check-id").value;
    const rider = $<HTMLInputElement>("check-addr").value.trim();

    if (!isAddress(rider)) {
      Object.assign(result, { hidden: false, className: "result bad" });
      result.innerHTML = `<h3>Invalid address</h3>`;
      return;
    }

    const verdict = await checkTicket(BigInt(id), rider);
    Object.assign(result, { hidden: false, className: `result ${verdict.ok ? "good" : "bad"}` });
    result.innerHTML = `<h3>${verdict.ok ? "✔" : "✘"} ${verdict.title}</h3><p>${verdict.reason}</p>`;
  };
}
