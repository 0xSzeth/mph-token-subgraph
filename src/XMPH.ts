import { BigDecimal, BigInt, Address, ethereum } from "@graphprotocol/graph-ts"
import {
  XMPHToken,
  Approval,
  Transfer,
  DistributeReward
} from "../generated/xMPHToken/XMPHToken"
import { xMPH, MPHHolder } from "../generated/schema"

let XMPH_ID = '0'
let XMPH_ADDRESS = Address.fromString("0x1702F18c1173b791900F81EbaE59B908Da8F689b")
let ZERO_DEC = BigDecimal.fromString('0')
let ONE_DEC = BigDecimal.fromString('1')
let ZERO_INT = BigInt.fromI32(0);
let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000')
let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(5); // call block handler every 5 blocks

function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(new BigDecimal(tenPow(decimals)))
}

function getMPHHolder(address: Address): MPHHolder | null {
  if (address.equals(ZERO_ADDR)) {
    return null
  }
  let entity = MPHHolder.load(address.toHex())
  if (entity == null) {
    entity = new MPHHolder(address.toHex())
    entity.address = address.toHex()
    entity.mphBalance = ZERO_DEC
    entity.xmphBalance = ZERO_DEC
    entity.mphStaked = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}

function getXMPH(id: string): xMPH {
  let xmph = xMPH.load(XMPH_ID)
  if (xmph == null) {
    xmph = new xMPH(XMPH_ID)
    xmph.totalSupply = ZERO_DEC
    xmph.pricePerFullShare = ONE_DEC
    xmph.totalRewardDistributed = ZERO_DEC
    xmph.currentUnlockEndTimestamp = ZERO_INT
    xmph.lastRewardTimestamp = ZERO_INT
    xmph.lastRewardAmount = ZERO_DEC
    xmph.save()
  }
  return xmph as xMPH;
}

export function handleApproval(event: Approval): void {}

export function handleTransfer(event: Transfer): void {
  let xmph = getXMPH(XMPH_ID);

  // update xMPH total supply on event transfer to/from zero address
  let value = normalize(event.params.value)
  if (event.params.from.equals(ZERO_ADDR)) {
    // mint
    xmph.totalSupply = xmph.totalSupply.plus(value)
  } else if (event.params.to.equals(ZERO_ADDR)) {
    // burn
    xmph.totalSupply = xmph.totalSupply.minus(value)
  }
  xmph.save()

  let from = getMPHHolder(event.params.from)
  let to = getMPHHolder(event.params.to)

  // if burned, then decrement the stakedMPH amount of from
  if (event.params.to.equals(ZERO_ADDR) && from != null) {
    from.mphStaked = from.mphStaked.minus(from.mphStaked.times(value).div(from.xmphBalance));
    from.save()
  }

  // update from address
  if (from != null) {
    from.xmphBalance = from.xmphBalance.minus(value)
    from.save()
  }

  // update to address
  if (to != null) {
    to.xmphBalance = to.xmphBalance.plus(value)
    to.save()
  }
}

export function handleDistributReward(event: DistributeReward): void {
  let xmph = getXMPH(XMPH_ID);
  xmph.totalRewardDistributed = xmph.totalRewardDistributed.plus(normalize(event.params.rewardAmount));
  xmph.save();
}

export function handleBlock(block: ethereum.Block): void {
  if (block.number.mod(BLOCK_HANDLER_INTERVAL).isZero()) {
    let xmph = getXMPH(XMPH_ID);
    let xmphContract = XMPHToken.bind(XMPH_ADDRESS)

    let pricePerFullShare = xmphContract.try_getPricePerFullShare()
    if (pricePerFullShare.reverted) {
      // do nothing
    } else {
      xmph.pricePerFullShare = normalize(pricePerFullShare.value)
    }

    let currentUnlockEndTimestamp = xmphContract.try_currentUnlockEndTimestamp();
    if (currentUnlockEndTimestamp.reverted) {
      // do nothing
    } else {
      xmph.currentUnlockEndTimestamp = currentUnlockEndTimestamp.value
    }

    let lastRewardTimestamp = xmphContract.try_lastRewardTimestamp();
    if (lastRewardTimestamp.reverted) {
      // do nothing
    } else {
      xmph.lastRewardTimestamp = lastRewardTimestamp.value
    }

    let lastRewardAmount = xmphContract.try_lastRewardAmount();
    if (lastRewardAmount.reverted) {
      // do nothing
    } else {
      xmph.lastRewardAmount = normalize(lastRewardAmount.value)
    }
    xmph.save()
  }
}
