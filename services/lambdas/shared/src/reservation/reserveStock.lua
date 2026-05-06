local stockKey = KEYS[1]
local saleUserKey = KEYS[2]
local userReservationsKey = KEYS[3]
local reservationKey = KEYS[4]
local expiriesKey = KEYS[5]
local idempotencyKey = KEYS[6]
local reservationId = ARGV[1]
local expiresAt = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local saleId = ARGV[4]
local userToken = ARGV[5]
local idempotencyEnabled = ARGV[6]
local reservationGraceSeconds = tonumber(ARGV[7])
local reservationRecordTtlSeconds = ttlSeconds + reservationGraceSeconds

if idempotencyEnabled == '1' and redis.call('EXISTS', idempotencyKey) == 1 then
  local replayedReservation = redis.call('HMGET', idempotencyKey, 'reservationId', 'remainingStock', 'expiresAt')
  return { 'RESERVED', replayedReservation[1], replayedReservation[2], replayedReservation[3], 'REPLAYED' }
end

if redis.call('EXISTS', saleUserKey) == 1 then
  return { 'ALREADY_RESERVED' }
end

local remaining = tonumber(redis.call('GET', stockKey) or '0')
if remaining <= 0 then
  return { 'SOLD_OUT' }
end

remaining = redis.call('DECR', stockKey)
redis.call('SET', saleUserKey, reservationId, 'EX', ttlSeconds)
redis.call('SADD', userReservationsKey, reservationId)
redis.call('HSET', reservationKey, 'saleId', saleId, 'userToken', userToken, 'status', 'RESERVED', 'expiresAt', expiresAt, 'remainingStock', tostring(remaining))
redis.call('EXPIRE', reservationKey, reservationRecordTtlSeconds)
if idempotencyEnabled == '1' then
  redis.call('HSET', idempotencyKey, 'reservationId', reservationId, 'remainingStock', tostring(remaining), 'expiresAt', expiresAt)
  redis.call('EXPIRE', idempotencyKey, ttlSeconds)
end
redis.call('ZADD', expiriesKey, expiresAt, reservationId)

return { 'RESERVED', reservationId, tostring(remaining), expiresAt, 'CREATED' }