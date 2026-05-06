-- releaseExpiredReservation.lua
-- KEYS[1] = reservation:{reservationId}
-- KEYS[2] = sale:{saleId}:expiries
-- ARGV[1] = reservationId
-- ARGV[2] = nowMs

local reservationKey = KEYS[1]
local expiriesKey = KEYS[2]
local reservationId = ARGV[1]
local nowMs = tonumber(ARGV[2])

if redis.call('EXISTS', reservationKey) == 0 then
  redis.call('ZREM', expiriesKey, reservationId)
  return { 'NOT_FOUND' }
end

local fields = redis.call('HMGET', reservationKey, 'saleId', 'userToken', 'status', 'expiresAt')
local saleId = fields[1]
local userToken = fields[2]
local status = fields[3]
local expiresAt = tonumber(fields[4])

if status ~= 'RESERVED' then
  redis.call('ZREM', expiriesKey, reservationId)
  return { 'SKIPPED' }
end

if expiresAt > nowMs then
  return { 'NOT_EXPIRED' }
end

redis.call('INCR', 'sale:' .. saleId .. ':stock')
redis.call('DEL', 'sale:' .. saleId .. ':user:' .. userToken)
redis.call('SREM', 'user:' .. userToken .. ':reservations', reservationId)
redis.call('ZREM', expiriesKey, reservationId)
redis.call('HSET', reservationKey, 'status', 'EXPIRED')

return { 'RELEASED', saleId, userToken, tostring(expiresAt) }
