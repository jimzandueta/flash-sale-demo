variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "flash-sale-platform"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "default_reservation_ttl_seconds" {
  type    = number
  default = 180
}

variable "vpc_id" {
  type = string
}

variable "lambda_subnet_ids" {
  type = list(string)
}

variable "lambda_security_group_ids" {
  type = list(string)
}

variable "elasticache_subnet_ids" {
  type = list(string)
}

variable "elasticache_security_group_ids" {
  type = list(string)
}

variable "session_api_zip_path" {
  type = string
}

variable "sales_api_zip_path" {
  type = string
}

variable "reservation_api_zip_path" {
  type = string
}

variable "checkout_api_zip_path" {
  type = string
}

variable "reservation_worker_zip_path" {
  type = string
}

variable "expiry_sweeper_zip_path" {
  type = string
}