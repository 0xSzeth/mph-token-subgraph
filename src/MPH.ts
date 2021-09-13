import { BigDecimal, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  MPHToken,
  Approval,
  OwnershipTransferred,
  Transfer
} from "../generated/MPHToken/MPHToken"
import { MPH, MPHHolder } from "../generated/schema"

let MPH_ID = '0'
let ZERO_DEC = BigDecimal.fromString('0')
let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000')

export function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

export function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(new BigDecimal(tenPow(decimals)))
}

export function getMPHHolder(address: Address): MPHHolder | null {
  if (address.equals(ZERO_ADDR)) {
    return null
  }
  let entity = MPHHolder.load(address.toHex())
  if (entity == null) {
    entity = new MPHHolder(address.toHex())
    entity.address = address.toHex()
    entity.mphBalance = ZERO_DEC
    entity.xmphBalance = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}

export function handleApproval(event: Approval): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleTransfer(event: Transfer): void {

  // find MPH entity or create it if it does not exist yet
  let mph = MPH.load(MPH_ID)
  if (mph == null) {
    mph = new MPH(MPH_ID)
    mph.totalSupply = ZERO_DEC
  }
  mph.save()

  // update MPH total supply on event transfer to/from zero address
  let value = normalize(event.params.value)
  if (event.params.from.equals(ZERO_ADDR)) {
    // mint
    mph.totalSupply = mph.totalSupply.plus(value)
  } else if (event.params.to.equals(ZERO_ADDR)) {
    // burn
    mph.totalSupply = mph.totalSupply.minus(value)
  }
  mph.save()

  // update from address
  let from = getMPHHolder(event.params.from)
  if (from != null) {
    from.mphBalance = from.mphBalance.minus(value)
    from.save()
  }

  // update to address
  let to = getMPHHolder(event.params.to)
  if (to != null) {
    to.mphBalance = to.mphBalance.plus(value)
    to.save()
  }

}
