# Providers Terraform — infrastructure Azure partagée TrustPass.
# State : local par défaut (voir backend.tf.example pour un state distant Azure Storage).
terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
  # subscription_id repris de la session `az login` si non fourni.
  subscription_id = var.subscription_id != "" ? var.subscription_id : null
}
