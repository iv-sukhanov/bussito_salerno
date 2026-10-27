# Bussito Salerno

Blockchain bus tickets for Salerno: buy a ticket (ERC-721) with a euro stablecoin, validate it when boarding, and let a conductor check it.

## 1. Install

```shell
npm install
cd frontend && npm install && cd ..
```

## 2. Run the tests

```shell
npx hardhat test solidity
```

## 3. Start a local blockchain

In **terminal 1**, keep it running:

```shell
npx hardhat node
```

## 4. Deploy the contracts

In **terminal 2**:

```shell
npx hardhat ignition deploy ignition/modules/BusTicket.ts --network localhost
```

## 5. Run the demo script (optional)

Runs the whole ticket lifecycle in the terminal: buy, validate, conductor check, expiry, withdraw.

```shell
npx hardhat run scripts/demo.ts --network localhost
```

## 6. Start the frontend

In **terminal 3**, keep it running:

```shell
cd frontend
npm run dev
```

Open http://localhost:5173.

## 7. Set up MetaMask (rider view)

1. Import a Hardhat test account into MetaMask. Account #1 private key:
   `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   (a public test key, printed by `npx hardhat node`; never use it on a real network).
2. Click **Connect MetaMask** in the app. It switches to the local network (chain ID 31337) automatically.
3. Click **Get 10 test EUR**, then **Buy ticket**, then **Validate**.

The **Conductor** tab needs no wallet: enter a ticket ID and the rider's address.
**Skip 91 min** in the footer moves the local chain clock forward to show a ticket expiring.

## Restarting

`npx hardhat node` starts from an empty chain every time, so after restarting it:

```shell
rm -rf ignition/deployments/chain-31337
npx hardhat ignition deploy ignition/modules/BusTicket.ts --network localhost
```

If MetaMask then shows nonce errors: Settings → Advanced → **Clear activity tab data**.
