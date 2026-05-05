-- cancelReservation.lua
-- KEYS[1] = reservation:{reservationId}
-- ARGV[1] = userToken
-- ARGV[2] = reservationId
--
-- Returns: ['CANCELLED'] | ['NOT_FOUND'] | ['FORBIDDEN'] | ['ALREADY_PURCHASED']

local reservationKey = KEYS[1]
local userToken = ARGV[1]
local reservationId = ARGV[2]

if redis.call('EXISTS', reservationKey) == 0 then
  return { 'NOT_FOUND' }
end

local fields = redis.call('HMGET', reservationKey, 'saleId', 'userToken', 'status')
local saleId      = fields[1]
local resToken    = fields[2]
local status      = fields[3]

if resToken ~= userToken then
  return { 'FORBIDDEN' }
end

if status ~= 'RESERVED' then
  return { 'ALREADY_PURCHASED' }
end

-- Atomically release all Redis state
redis.call('INCR',  'sale:' .. saleId .. ':stock')
redis.call('DEL',   'sale:' .. saleId .. ':user:' .. userToken)
redis.call('SREM',  'user:' .. userToken .. ':reservations', reservationId)
redis.call('ZREM',  'sale:' .. saleId .. ':expiries', reservationId)
redis.call('DEL',   reservationKey)

return { 'CANCELLED' }
