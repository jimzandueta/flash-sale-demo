output "reservations_table_name" {
  value = aws_dynamodb_table.reservations.name
}

output "reservation_events_queue_url" {
  value = aws_sqs_queue.reservation_events.id
}

output "default_reservation_ttl_parameter_name" {
  value = aws_ssm_parameter.default_reservation_ttl.name
}

output "http_api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

output "reservation_api_function_name" {
  value = aws_lambda_function.reservation_api.function_name
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}