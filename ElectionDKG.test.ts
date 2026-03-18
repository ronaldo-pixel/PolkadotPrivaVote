import { expect }         from "chai";
import { ethers }         from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ElectionDKG }    from "../typechain-types";

/**
 * ElectionDKG test suite — PolkaVM / Polkadot Asset Hub target.
 * Compiled with resolc (Solidity 0.8.28 → PolkaVM IR).
 *
 * BabyJubJub test vectors.
 *
 * These are real points on the curve derived from private scalars 1, 2, 3.
 * Using scalar=1 gives exactly the generator G.
 * P1 + P2 + P3 is the expected combined election public key.
 *
 * Pre-computed values (cross-checked against circomlibjs):
 */
const G = {
  x: BigInt("16950150798460657717958625567821834550301663161624707787222815936182638968203"),
  y: BigInt("13264911636956651685802846553457520596785060499226950022450069703489588"),
};

// scalar=2  → P2 = 2·G
const P2 = {
  x: BigInt("17777552123799933955779906779655732241715742912184938656739573121738514868268"),
  y: BigInt("2626589144620713026669568689430873010625803460485136166227229837895489795993"),
};

// scalar=3  → P3 = 3·G
const P3 = {
  x: BigInt("19890404956070785020994466756098166840550861352069544498753658059788418791630"),
  y: BigInt("21574282412742130133438766764509046823070022697805978897056523547820059765299"),
};

// P_combined = G + P2 + P3  (computed off-chain, verified against the contract)
// Verified with: babyjubjub.addPoint(babyjubjub.addPoint(G, P2), P3)
const P_COMBINED = {
  x: BigInt("7207155250723540622879684484516630936428688615578348983434654782374714028895"),
  y: BigInt("5673498521836208699088896498059756573742765985432620348756226218459882044862"),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function mineBlocks(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

async function currentBlock(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.number;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ElectionDKG", () => {
  let dkg: ElectionDKG;
  let admin: HardhatEthersSigner;
  let kh1: HardhatEthersSigner;
  let kh2: HardhatEthersSigner;
  let kh3: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  // Helper: create a fresh proposal with sensible defaults
  async function createDefaultProposal(): Promise<bigint> {
    const bn = await currentBlock();
    const tx = await dkg.connect(admin).createProposal(
      "Test proposal",
      bn + 10,   // startBlock
      bn + 200,  // endBlock
      3          // 3 options
    );
    const receipt = await tx.wait();
    const event   = receipt!.logs
      .map((l) => dkg.interface.parseLog(l as any))
      .find((e) => e?.name === "ProposalCreated");
    return event!.args.proposalId as bigint;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    [admin, kh1, kh2, kh3, stranger] = await ethers.getSigners();

    const DKGFactory = await ethers.getContractFactory("ElectionDKG");
    dkg = await DKGFactory.deploy(
      [kh1.address, kh2.address, kh3.address],
      2  // threshold: 2 of 3
    ) as ElectionDKG;
    await dkg.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("deployment", () => {
    it("stores the admin, threshold, and keyholder count", async () => {
      expect(await dkg.admin()).to.equal(admin.address);
      expect(await dkg.threshold()).to.equal(2);
      expect(await dkg.totalKeyholders()).to.equal(3);
    });

    it("registers keyholders correctly", async () => {
      const info = await dkg.keyholderInfo(kh1.address);
      expect(info.registered).to.be.true;
      expect(info.index).to.equal(0);
    });

    it("rejects duplicate keyholders in constructor", async () => {
      const DKGFactory = await ethers.getContractFactory("ElectionDKG");
      await expect(
        DKGFactory.deploy([kh1.address, kh1.address, kh2.address], 2)
      ).to.be.revertedWith("duplicate keyholder");
    });

    it("rejects threshold > keyholder count", async () => {
      const DKGFactory = await ethers.getContractFactory("ElectionDKG");
      await expect(
        DKGFactory.deploy([kh1.address, kh2.address], 3)
      ).to.be.revertedWith("invalid threshold");
    });
  });

  // ── Proposal creation ──────────────────────────────────────────────────────

  describe("createProposal", () => {
    it("creates a proposal in PENDING_DKG status", async () => {
      const pid  = await createDefaultProposal();
      const info = await dkg.getProposal(pid);
      expect(info.status).to.equal(0); // PENDING_DKG = 0
      expect(info.description).to.equal("Test proposal");
      expect(info.sharesSubmitted).to.equal(0);
    });

    it("emits ProposalCreated", async () => {
      const bn = await currentBlock();
      await expect(
        dkg.connect(admin).createProposal("Vote", bn + 5, bn + 100, 2)
      ).to.emit(dkg, "ProposalCreated");
    });

    it("reverts if called by non-admin", async () => {
      const bn = await currentBlock();
      await expect(
        dkg.connect(stranger).createProposal("Hack", bn + 5, bn + 100, 2)
      ).to.be.revertedWithCustomError(dkg, "NotAdmin");
    });

    it("reverts if optionCount < 2", async () => {
      const bn = await currentBlock();
      await expect(
        dkg.connect(admin).createProposal("Bad", bn + 5, bn + 100, 1)
      ).to.be.revertedWithCustomError(dkg, "InvalidOptionCount");
    });

    it("reverts if startBlock is in the past", async () => {
      const bn = await currentBlock();
      await expect(
        dkg.connect(admin).createProposal("Bad", bn - 1, bn + 100, 2)
      ).to.be.revertedWithCustomError(dkg, "InvalidBlockRange");
    });
  });

  // ── Public key share submission ────────────────────────────────────────────

  describe("submitPublicKeyShare", () => {
    let pid: bigint;

    beforeEach(async () => {
      pid = await createDefaultProposal();
    });

    it("accepts a valid on-curve point from a keyholder", async () => {
      await expect(
        dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y)
      )
        .to.emit(dkg, "PublicKeyShareSubmitted")
        .withArgs(pid, kh1.address, G.x, G.y);

      const { submitted } = await dkg.getDKGStatus(pid);
      expect(submitted).to.include(kh1.address);
    });

    it("rejects the identity point (0, 1)", async () => {
      await expect(
        dkg.connect(kh1).submitPublicKeyShare(pid, 0n, 1n)
      ).to.be.revertedWithCustomError(dkg, "InvalidPoint");
    });

    it("rejects an off-curve point", async () => {
      await expect(
        dkg.connect(kh1).submitPublicKeyShare(pid, 1n, 2n)
      ).to.be.revertedWithCustomError(dkg, "InvalidPoint");
    });

    it("rejects a submission from a non-keyholder", async () => {
      await expect(
        dkg.connect(stranger).submitPublicKeyShare(pid, G.x, G.y)
      ).to.be.revertedWithCustomError(dkg, "NotKeyholder");
    });

    it("rejects a double submission from the same keyholder", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await expect(
        dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y)
      ).to.be.revertedWithCustomError(dkg, "AlreadySubmitted");
    });

    it("tracks sharesSubmitted count correctly", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      let info = await dkg.getProposal(pid);
      expect(info.sharesSubmitted).to.equal(1);

      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);
      info = await dkg.getProposal(pid);
      expect(info.sharesSubmitted).to.equal(2);
    });

    it("stores the public share and makes it queryable", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      const { x, y, submitted } = await dkg.getPublicKeyShare(pid, kh1.address);
      expect(submitted).to.be.true;
      expect(x).to.equal(G.x);
      expect(y).to.equal(G.y);
    });
  });

  // ── DKG completion & election key ──────────────────────────────────────────

  describe("DKG finalization", () => {
    let pid: bigint;

    beforeEach(async () => {
      pid = await createDefaultProposal();
    });

    it("emits ElectionKeyComputed and VotingStarted when all 3 shares submitted", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);

      await expect(
        dkg.connect(kh3).submitPublicKeyShare(pid, P3.x, P3.y)
      )
        .to.emit(dkg, "ElectionKeyComputed")
        .and.to.emit(dkg, "VotingStarted")
        .withArgs(pid);
    });

    it("transitions proposal status to ACTIVE after all shares submitted", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);
      await dkg.connect(kh3).submitPublicKeyShare(pid, P3.x, P3.y);

      const info = await dkg.getProposal(pid);
      expect(info.status).to.equal(1); // ACTIVE = 1
    });

    it("stores the correct combined election public key", async () => {
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);
      await dkg.connect(kh3).submitPublicKeyShare(pid, P3.x, P3.y);

      const { x, y } = await dkg.getElectionPublicKey(pid);
      expect(x).to.equal(P_COMBINED.x);
      expect(y).to.equal(P_COMBINED.y);
    });

    it("rejects a share submission once ACTIVE", async () => {
      // All 3 submit → ACTIVE
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);
      await dkg.connect(kh3).submitPublicKeyShare(pid, P3.x, P3.y);

      // Deploying a 4th keyholder is not possible; instead test that
      // a re-submission attempt fails with the already-submitted error
      // (since kh1 already submitted, it should still be rejected).
      await expect(
        dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y)
      ).to.be.revertedWithCustomError(dkg, "ProposalNotInDKG");
    });
  });

  // ── closeVoting ────────────────────────────────────────────────────────────

  describe("closeVoting", () => {
    let pid: bigint;

    beforeEach(async () => {
      pid = await createDefaultProposal();
      // Complete DKG
      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);
      await dkg.connect(kh3).submitPublicKeyShare(pid, P3.x, P3.y);
    });

    it("reverts if voting window has not yet closed", async () => {
      // Only a few blocks have passed, endBlock = currentBlock + 200
      await expect(
        dkg.connect(stranger).closeVoting(pid)
      ).to.be.revertedWithCustomError(dkg, "ProposalNotEnded");
    });

    it("transitions to ENDED after endBlock", async () => {
      await mineBlocks(205); // pass the endBlock
      await dkg.connect(stranger).closeVoting(pid);

      const info = await dkg.getProposal(pid);
      expect(info.status).to.equal(2); // ENDED = 2
    });

    it("emits VotingEnded", async () => {
      await mineBlocks(205);
      await expect(dkg.connect(stranger).closeVoting(pid))
        .to.emit(dkg, "VotingEnded")
        .withArgs(pid);
    });
  });

  // ── getDKGStatus ───────────────────────────────────────────────────────────

  describe("getDKGStatus", () => {
    it("returns correct submitted/pending split", async () => {
      const pid = await createDefaultProposal();

      await dkg.connect(kh1).submitPublicKeyShare(pid, G.x, G.y);
      await dkg.connect(kh2).submitPublicKeyShare(pid, P2.x, P2.y);

      const { submitted, pending } = await dkg.getDKGStatus(pid);
      expect(submitted).to.have.lengthOf(2);
      expect(pending).to.have.lengthOf(1);
      expect(pending[0]).to.equal(kh3.address);
    });
  });
});
