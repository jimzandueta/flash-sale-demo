-- checkoutReservation.lua
-- KEYS[1] = reservation:{reservationId}
-- ARGV[1] = userToken
-- ARGV[2] = reservationId
-- ARGV[3] = nowMs
-- ARGV[4] = purchasedAt
-- ARGV[5] = simulateFailure ('1' or '0')

local reservationKey = KEYS[1]
local userToken = ARGV[1]
local reservationId = ARGV[2]
local nowMs = tonumber(ARGV[3])
local purchasedAt = ARGV[4]
local simulateFailure = ARGV[5]

if redis.call('EXISTS', reservationKey) == 0 then
  return { 'RESERVATION_EXPIRED' }
end

local fields = redis.call('HMGET', reservationKey, 'saleId', 'userToken', 'status', 'expiresAt')
local saleId = fields[1]
local ownerToken = fields[2]
local status = fields[3]
local expiresAt = tonumber(fields[4])

if ownerToken ~= userToken then
  return { 'RESERVATION_EXPIRED' }
end

if status ~= 'RESERVED' then
  return { 'RESERVATION_EXPIRED' }
end

if expiresAt <= nowMs then
  redis.call('INCR', 'sale:' .. saleId .. ':stock')
  redis.call('DEL', 'sale:' .. saleId .. ':user:' .. userToken)
  redis.call('SREM', 'user:' .. userToken .. ':reservations', reservationId)
  redis.call('ZREM', 'sale:' .. saleId .. ':expiries', reservationId)
  redis.call('HSET', reservationKey, 'status', 'EXPIRED')
  return { 'RESERVATION_EXPIRED' }
end

if simulateFailure == '1' then
  return { 'PAYMENT_FAILED' }
end

redis.call('HSET', reservationKey, 'status', 'PURCHASED', 'purchasedAt', purchasedAt)
redis.call('DEL', 'sale:' .. saleId .. ':user:' .. userToken)
redis.call('SREM', 'user:' .. userToken .. ':reservations', reservationId)
redis.call('ZREM', 'sale:' .. saleId .. ':expiries', reservationId)

return { 'PURCHASED', purchasedAt }
