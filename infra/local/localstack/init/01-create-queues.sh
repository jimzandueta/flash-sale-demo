#!/usr/bin/env sh

set -eu

awslocal sqs create-queue --queue-name dev-reservation-events >/dev/null
awslocal sqs create-queue --queue-name dev-purchase-events >/dev/null
awslocal sqs create-queue --queue-name dev-expiry-events >/dev/null
awslocal sqs create-queue --queue-name dev-worker-failures >/dev/null