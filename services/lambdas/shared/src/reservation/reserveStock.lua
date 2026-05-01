local stockKey = KEYS[1]
local saleUserKey = KEYS[2]
local userReservationsKey = KEYS[3]
local reservationKey = KEYS[4]
local expiriesKey = KEYS[5]
local reservationId = ARGV[1]
local expiresAt = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local saleId = ARGV[4]
local userToken = ARGV[5]

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
redis.call('HSET', reservationKey, 'saleId', saleId, 'userToken', userToken, 'status', 'RESERVED', 'expiresAt', expiresAt)
redis.call('EXPIRE', reservationKey, ttlSeconds)
redis.call('ZADD', expiriesKey, expiresAt, reservationId)

return { 'RESERVED', reservationId, tostring(remaining), expiresAt }