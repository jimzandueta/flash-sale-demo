resource "aws_ssm_parameter" "default_reservation_ttl" {
  name  = "/flash-sale/config/default-reservation-ttl-seconds"
  type  = "String"
  value = tostring(var.default_reservation_ttl_seconds)

  tags = local.common_tags
}

resource "aws_dynamodb_table" "reservations" {
  name         = "${local.name_prefix}-reservations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "reservationId"

  attribute {
    name = "reservationId"
    type = "S"
  }

  tags = local.common_tags
}

resource "aws_sqs_queue" "worker_failures" {
  name = "${local.name_prefix}-worker-failures"

  tags = local.common_tags
}

resource "aws_sqs_queue" "reservation_events" {
  name = "${local.name_prefix}-reservation-events"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.worker_failures.arn
    maxReceiveCount     = 5
  })

  tags = local.common_tags
}

resource "aws_sqs_queue" "purchase_events" {
  name = "${local.name_prefix}-purchase-events"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.worker_failures.arn
    maxReceiveCount     = 5
  })

  tags = local.common_tags
}

resource "aws_sqs_queue" "expiry_events" {
  name = "${local.name_prefix}-expiry-events"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.worker_failures.arn
    maxReceiveCount     = 5
  })

  tags = local.common_tags
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = var.elasticache_subnet_ids
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Dev Redis for flash sale platform"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 1
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = var.elasticache_security_group_ids
  automatic_failover_enabled = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false
  apply_immediately          = true
  port                       = 6379

  tags = local.common_tags
}

resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "${local.name_prefix}-frontend-"
  force_destroy = true

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.reservations.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.reservation_events.arn,
          aws_sqs_queue.purchase_events.arn,
          aws_sqs_queue.expiry_events.arn,
          aws_sqs_queue.worker_failures.arn
        ]
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.default_reservation_ttl.arn
      }
    ]
  })
}

resource "aws_lambda_function" "session_api" {
  function_name = "${local.name_prefix}-session-api"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.session_api_zip_path
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      AWS_REGION                     = var.aws_region
      DEFAULT_RESERVATION_TTL_SECONDS = tostring(var.default_reservation_ttl_seconds)
      DEFAULT_TTL_PARAMETER_NAME     = aws_ssm_parameter.default_reservation_ttl.name
    }
  }

  depends_on = [aws_iam_role_policy.lambda_exec]
  tags       = local.common_tags
}

resource "aws_lambda_function" "sales_api" {
  function_name = "${local.name_prefix}-sales-api"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.sales_api_zip_path
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      AWS_REGION                     = var.aws_region
      DEFAULT_RESERVATION_TTL_SECONDS = tostring(var.default_reservation_ttl_seconds)
    }
  }

  depends_on = [aws_iam_role_policy.lambda_exec]
  tags       = local.common_tags
}

resource "aws_lambda_function" "reservation_api" {
  function_name = "${local.name_prefix}-reservation-api"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.reservation_api_zip_path
  timeout       = 15
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION                     = var.aws_region
      REDIS_URL                      = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
      DEFAULT_RESERVATION_TTL_SECONDS = tostring(var.default_reservation_ttl_seconds)
      RESERVATIONS_TABLE             = aws_dynamodb_table.reservations.name
      RESERVATION_EVENTS_QUEUE_URL   = aws_sqs_queue.reservation_events.id
      DEFAULT_TTL_PARAMETER_NAME     = aws_ssm_parameter.default_reservation_ttl.name
    }
  }

  vpc_config {
    subnet_ids         = var.lambda_subnet_ids
    security_group_ids = var.lambda_security_group_ids
  }

  depends_on = [
    aws_iam_role_policy.lambda_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
  tags = local.common_tags
}

resource "aws_lambda_function" "checkout_api" {
  function_name = "${local.name_prefix}-checkout-api"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.checkout_api_zip_path
  timeout       = 15
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION                = var.aws_region
      REDIS_URL                 = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
      RESERVATIONS_TABLE        = aws_dynamodb_table.reservations.name
      PURCHASE_EVENTS_QUEUE_URL = aws_sqs_queue.purchase_events.id
    }
  }

  vpc_config {
    subnet_ids         = var.lambda_subnet_ids
    security_group_ids = var.lambda_security_group_ids
  }

  depends_on = [
    aws_iam_role_policy.lambda_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
  tags = local.common_tags
}

resource "aws_lambda_function" "reservation_worker" {
  function_name = "${local.name_prefix}-reservation-worker"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.reservation_worker_zip_path
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION                   = var.aws_region
      RESERVATIONS_TABLE           = aws_dynamodb_table.reservations.name
      RESERVATION_EVENTS_QUEUE_URL = aws_sqs_queue.reservation_events.id
      PURCHASE_EVENTS_QUEUE_URL    = aws_sqs_queue.purchase_events.id
      EXPIRY_EVENTS_QUEUE_URL      = aws_sqs_queue.expiry_events.id
    }
  }

  depends_on = [aws_iam_role_policy.lambda_exec]
  tags       = local.common_tags
}

resource "aws_lambda_function" "expiry_sweeper" {
  function_name = "${local.name_prefix}-expiry-sweeper"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = var.expiry_sweeper_zip_path
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION              = var.aws_region
      REDIS_URL               = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
      EXPIRY_EVENTS_QUEUE_URL = aws_sqs_queue.expiry_events.id
    }
  }

  vpc_config {
    subnet_ids         = var.lambda_subnet_ids
    security_group_ids = var.lambda_security_group_ids
  }

  depends_on = [
    aws_iam_role_policy.lambda_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
  tags = local.common_tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name_prefix}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type", "x-user-token", "idempotency-key"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "session_api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.session_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "sales_api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.sales_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "reservation_api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.reservation_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "checkout_api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.checkout_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_sessions" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sessions"
  target    = "integrations/${aws_apigatewayv2_integration.session_api.id}"
}

resource "aws_apigatewayv2_route" "get_sales" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /sales"
  target    = "integrations/${aws_apigatewayv2_integration.sales_api.id}"
}

resource "aws_apigatewayv2_route" "post_reservations" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sales/{saleId}/reservations"
  target    = "integrations/${aws_apigatewayv2_integration.reservation_api.id}"
}

resource "aws_apigatewayv2_route" "get_reservations" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /reservations"
  target    = "integrations/${aws_apigatewayv2_integration.reservation_api.id}"
}

resource "aws_apigatewayv2_route" "get_reservation_by_id" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /reservations/{reservationId}"
  target    = "integrations/${aws_apigatewayv2_integration.reservation_api.id}"
}

resource "aws_apigatewayv2_route" "delete_reservation" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "DELETE /reservations/{reservationId}"
  target    = "integrations/${aws_apigatewayv2_integration.reservation_api.id}"
}

resource "aws_apigatewayv2_route" "post_checkout" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /reservations/{reservationId}/checkout"
  target    = "integrations/${aws_apigatewayv2_integration.checkout_api.id}"
}

resource "aws_lambda_event_source_mapping" "reservation_events" {
  event_source_arn = aws_sqs_queue.reservation_events.arn
  function_name    = aws_lambda_function.reservation_worker.arn
  batch_size       = 10
}

resource "aws_lambda_event_source_mapping" "purchase_events" {
  event_source_arn = aws_sqs_queue.purchase_events.arn
  function_name    = aws_lambda_function.reservation_worker.arn
  batch_size       = 10
}

resource "aws_lambda_event_source_mapping" "expiry_events" {
  event_source_arn = aws_sqs_queue.expiry_events.arn
  function_name    = aws_lambda_function.reservation_worker.arn
  batch_size       = 10
}

resource "aws_cloudwatch_event_rule" "expiry_sweeper" {
  name                = "${local.name_prefix}-expiry-sweeper"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "expiry_sweeper" {
  rule = aws_cloudwatch_event_rule.expiry_sweeper.name
  arn  = aws_lambda_function.expiry_sweeper.arn
}

resource "aws_lambda_permission" "allow_session_api" {
  statement_id  = "AllowExecutionFromApiGatewaySession"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.session_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_sales_api" {
  statement_id  = "AllowExecutionFromApiGatewaySales"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sales_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_reservation_api" {
  statement_id  = "AllowExecutionFromApiGatewayReservation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reservation_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_checkout_api" {
  statement_id  = "AllowExecutionFromApiGatewayCheckout"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.checkout_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_eventbridge_expiry_sweeper" {
  statement_id  = "AllowExecutionFromEventBridgeExpirySweeper"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.expiry_sweeper.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.expiry_sweeper.arn
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.frontend.id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    target_origin_id       = aws_s3_bucket.frontend.id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.frontend.arn}/*"]
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}