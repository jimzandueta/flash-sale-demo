#!/usr/bin/env sh

set -eu

awslocal ssm put-parameter \
  --name /flash-sale/config/default-reservation-ttl-seconds \
  --type String \
  --value 300 \
  --overwrite >/dev/null